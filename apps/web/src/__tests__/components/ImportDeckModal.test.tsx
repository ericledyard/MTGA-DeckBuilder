import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ImportDeckModal,
  type ResolvedImportCard,
} from "@/components/decks/ImportDeckModal";

/**
 * The import modal is where several deliberate decisions live: fuzzy matches
 * are shown for review and never applied silently, a failed lookup must not
 * render as "0 found", and not-found cards are skipped rather than blocking
 * the import. Each of those was a bug once.
 */

type LookupCard = {
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  cmc: number;
  type_line: string;
  colors: string[];
  color_identity: string[];
  oracle_text: string | null;
  image_uri_normal: string | null;
  rarity: string;
  set_code: string | null;
  collector_number: string | null;
};

function lookupCard(over: Partial<LookupCard> & { name: string }): LookupCard {
  return {
    oracle_id: over.name.toLowerCase().replace(/[^a-z]+/g, "-"),
    mana_cost: "{1}{G}",
    cmc: 2,
    type_line: "Creature — Elf",
    colors: ["G"],
    color_identity: ["G"],
    oracle_text: null,
    image_uri_normal: null,
    rarity: "common",
    set_code: "tst",
    collector_number: "1",
    ...over,
  };
}

/** Stub POST /api/cards/lookup with a given payload or failure. */
function stubLookup(
  payload: { cards?: LookupCard[]; fuzzy?: unknown[] } | { status: number },
) {
  const fetchMock = vi.fn(async () => {
    if ("status" in payload) {
      return new Response(JSON.stringify({ error: "Card lookup failed." }), {
        status: payload.status,
      });
    }
    return new Response(
      JSON.stringify({
        cards: payload.cards ?? [],
        fuzzy: payload.fuzzy ?? [],
      }),
      { status: 200 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderModal({
  currentCardCount = 0,
  onImport = vi.fn<
    (cards: ResolvedImportCard[], replace: boolean) => Promise<void>
  >(async () => {}),
  onClose = vi.fn(),
}: {
  currentCardCount?: number;
  onImport?: ReturnType<
    typeof vi.fn<
      (cards: ResolvedImportCard[], replace: boolean) => Promise<void>
    >
  >;
  onClose?: () => void;
} = {}) {
  render(
    <ImportDeckModal
      deckId="deck-1"
      currentCardCount={currentCardCount}
      onImport={onImport}
      onClose={onClose}
    />,
  );
  return { onImport, onClose };
}

const paste = async (
  user: ReturnType<typeof userEvent.setup>,
  text: string,
) => {
  await user.click(screen.getByRole("textbox"));
  await user.paste(text);
  await user.click(screen.getByRole("button", { name: /parse & preview/i }));
};

describe("ImportDeckModal — parsing and preview", () => {
  it("summarises found and not-found cards", async () => {
    const user = userEvent.setup();
    stubLookup({ cards: [lookupCard({ name: "Llanowar Elves" })] });
    renderModal();

    await paste(user, "4 Llanowar Elves\n2 Not A Real Card");

    expect(await screen.findByText(/1 found/)).toBeInTheDocument();
    expect(screen.getByText(/1 not found/)).toBeInTheDocument();
    // Quantity comes from the pasted list, not the number of distinct names.
    expect(screen.getByText(/4 total cards/)).toBeInTheDocument();
  });

  it("rejects input with no card lines", async () => {
    const user = userEvent.setup();
    stubLookup({ cards: [] });
    renderModal();

    await paste(user, "// just a comment header");

    expect(await screen.findByText(/no card lines found/i)).toBeInTheDocument();
  });

  it("marks commander and sideboard rows", async () => {
    const user = userEvent.setup();
    stubLookup({
      cards: [
        lookupCard({
          name: "Aragorn and Arwen, Wed",
          type_line: "Legendary Creature — Human Elf Noble",
        }),
        lookupCard({ name: "Negate", type_line: "Instant" }),
      ],
    });
    renderModal();

    await paste(
      user,
      "Commander\n1 Aragorn and Arwen, Wed\n\nSideboard\n2 Negate",
    );

    expect(await screen.findByText("CMD")).toBeInTheDocument();
    expect(screen.getByText("side")).toBeInTheDocument();
  });
});

describe("ImportDeckModal — fuzzy matches are shown, never silent", () => {
  it("labels a fuzzy match and shows what it resolved to", async () => {
    const user = userEvent.setup();
    stubLookup({
      cards: [],
      fuzzy: [
        {
          ...lookupCard({ name: "Llanowar Elves" }),
          query_name: "Llanowar Elf",
          score: 0.647,
        },
      ],
    });
    renderModal();

    await paste(user, "1 Llanowar Elf");

    expect(await screen.findByText(/1 close match/)).toBeInTheDocument();
    // The typed name and the matched name are both shown, so a wrong guess is
    // visible before it lands in the deck.
    expect(screen.getByText(/→\s*Llanowar Elves/)).toBeInTheDocument();
    expect(
      screen.getByText(/check these before importing/i),
    ).toBeInTheDocument();
  });

  it("prefers an exact match over a fuzzy one", async () => {
    const user = userEvent.setup();
    stubLookup({
      cards: [lookupCard({ name: "Llanowar Elves" })],
      fuzzy: [
        {
          ...lookupCard({ name: "Llanowar Elite" }),
          query_name: "llanowar elves",
          score: 0.9,
        },
      ],
    });
    renderModal();

    await paste(user, "1 Llanowar Elves");

    expect(await screen.findByText(/1 found/)).toBeInTheDocument();
    expect(screen.queryByText(/close match/)).not.toBeInTheDocument();
  });
});

describe("ImportDeckModal — failures are not empty results", () => {
  it("shows an error when the lookup itself fails", async () => {
    const user = userEvent.setup();
    stubLookup({ status: 503 });
    renderModal();

    await paste(user, "1 Llanowar Elves");

    // A 503 means the lookup broke, not that the card does not exist. This is
    // exactly the bug that surfaced as "88 cards not found" in session 17.
    expect(await screen.findByText(/card lookup failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
    // And it returns to the input step so the paste is not lost.
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });
});

describe("ImportDeckModal — importing", () => {
  it("passes only resolved cards to onImport and skips the rest", async () => {
    const user = userEvent.setup();
    stubLookup({ cards: [lookupCard({ name: "Llanowar Elves" })] });
    const { onImport } = renderModal();

    await paste(user, "4 Llanowar Elves\n2 Not A Real Card");
    await user.click(await screen.findByRole("button", { name: /import 4/i }));

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    const [cards] = onImport.mock.calls[0];
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ name: "Llanowar Elves", quantity: 4 });
  });

  it("carries colour identity and oracle text through to the deck", async () => {
    const user = userEvent.setup();
    stubLookup({
      cards: [
        lookupCard({
          name: "Relentless Rats",
          type_line: "Creature — Rat",
          colors: ["B"],
          color_identity: ["B"],
          oracle_text:
            "A deck can have any number of cards named Relentless Rats.",
        }),
      ],
    });
    const { onImport } = renderModal();

    await paste(user, "10 Relentless Rats");
    await user.click(await screen.findByRole("button", { name: /import 10/i }));

    await waitFor(() => expect(onImport).toHaveBeenCalledOnce());
    const [cards] = onImport.mock.calls[0];
    // Without these the imported deck is silently exempt from the commander
    // colour-identity rule and from per-card copy allowances.
    expect(cards[0].color_identity).toEqual(["B"]);
    expect(cards[0].oracle_text).toMatch(/any number of cards named/i);
  });

  it("disables import when nothing resolved", async () => {
    const user = userEvent.setup();
    stubLookup({ cards: [] });
    renderModal();

    await paste(user, "1 Not A Real Card");

    expect(await screen.findByText(/1 not found/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^import/i })).toBeDisabled();
  });

  it("offers replace only when the deck already has cards", async () => {
    const user = userEvent.setup();
    stubLookup({ cards: [lookupCard({ name: "Llanowar Elves" })] });
    renderModal({ currentCardCount: 12 });

    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText(/replace existing 12 cards/i)).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox"));
    await paste(user, "1 Llanowar Elves");
    await user.click(await screen.findByRole("button", { name: /import 1/i }));

    await waitFor(() => expect(screen.queryByText(/importing/i)).toBeTruthy());
  });

  it("has no replace option for an empty deck", () => {
    stubLookup({ cards: [] });
    renderModal({ currentCardCount: 0 });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
