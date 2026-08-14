import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DeckEditor } from "@/components/decks/DeckEditor";
import type { CardRowData } from "@/components/decks/DeckCardRow";

/**
 * Copy limits and the commander slot, exercised through the real component.
 *
 * The rules themselves are unit-tested in @mtga/core; what these cover is the
 * wiring the unit tests cannot see — that the limit is actually consulted on
 * the add path, and that the commander slot counts toward it. Both were broken
 * in ways a green typecheck did not catch.
 */

type SearchCardFixture = {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  cmc: number | null;
  type_line: string;
  colors: string[];
  color_identity: string[];
  oracle_text: string | null;
  image_uri_normal: string | null;
  rarity: string;
  set_code: string | null;
};

function searchCard(over: Partial<SearchCardFixture> & { name: string }) {
  const slug = over.name.toLowerCase().replace(/[^a-z]+/g, "-");
  return {
    id: `${slug}-print`,
    oracle_id: slug,
    mana_cost: "{1}{G}",
    cmc: 2,
    type_line: "Creature — Elf",
    colors: ["G"],
    color_identity: ["G"],
    oracle_text: null,
    image_uri_normal: `https://cards.example/${slug}.jpg`,
    rarity: "common",
    set_code: "tst",
    ...over,
  } satisfies SearchCardFixture;
}

const ARAGORN = searchCard({
  name: "Aragorn and Arwen, Wed",
  type_line: "Legendary Creature — Human Elf Noble",
  mana_cost: "{4}{G}{W}",
  cmc: 6,
  colors: ["G", "W"],
  color_identity: ["G", "W"],
  oracle_text: "Vigilance",
});

const ELVES = searchCard({ name: "Llanowar Elves" });

const FOREST = searchCard({
  name: "Forest",
  type_line: "Basic Land — Forest",
  mana_cost: null,
  cmc: 0,
  colors: [],
  color_identity: ["G"],
});

const RATS = searchCard({
  name: "Relentless Rats",
  type_line: "Creature — Rat",
  colors: ["B"],
  color_identity: ["B"],
  oracle_text: "A deck can have any number of cards named Relentless Rats.",
});

/** Stub the two endpoints the editor calls on mount. */
function stubFetch(results: SearchCardFixture[]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/cards/search")) {
      return new Response(JSON.stringify(results), { status: 200 });
    }
    if (url.startsWith("/api/cards/sets")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderEditor({
  format = "commander",
  deckCards = [] as CardRowData[],
  results = [ARAGORN, ELVES, FOREST],
}: {
  format?: string;
  deckCards?: CardRowData[];
  results?: SearchCardFixture[];
} = {}) {
  stubFetch(results);
  return render(
    <DeckEditor
      deck={{
        id: "deck-1",
        name: "Test Deck",
        format,
        description: null,
        deck_cards: deckCards,
      }}
      mode="local"
    />,
  );
}

/** The search-grid tile for a card, found via its card image. */
function tile(name: string): HTMLElement {
  const img = screen.getAllByRole("img", { name }).at(-1);
  if (!img) throw new Error(`no tile for ${name}`);
  const button = img.closest("button");
  if (!button) throw new Error(`tile for ${name} has no button`);
  return button;
}

/** The amber in-deck count badge on a tile, or null when absent. */
function badge(name: string): string | null {
  const el = tile(name).querySelector(".bg-amber-500");
  return el ? (el.textContent?.trim() ?? null) : null;
}

async function waitForGrid(name: string) {
  await waitFor(() => expect(tile(name)).toBeInTheDocument());
}

describe("DeckEditor — commander slot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows an in-deck badge on the card sitting in the commander slot", async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForGrid(ARAGORN.name);

    // No badge before it is in the deck.
    expect(badge(ARAGORN.name)).toBeNull();

    await user.click(screen.getByRole("button", { name: /commander \+/i }));
    await user.click(tile(ARAGORN.name));

    // Regression: the badge map was built from the active tab only, which
    // excludes the commander slot, so a commander showed no badge at all.
    await waitFor(() => expect(badge(ARAGORN.name)).toBe("1"));
  });

  it("refuses a second copy of the card already used as commander", async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForGrid(ARAGORN.name);

    await user.click(screen.getByRole("button", { name: /commander \+/i }));
    await user.click(tile(ARAGORN.name));
    await waitFor(() => expect(badge(ARAGORN.name)).toBe("1"));

    await user.click(tile(ARAGORN.name));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /only one copy allowed in Commander/i,
    );
    expect(badge(ARAGORN.name)).toBe("1");
  });

  it("rejects a card that cannot legally be a commander", async () => {
    const user = userEvent.setup();
    renderEditor();
    await waitForGrid(ELVES.name);

    await user.click(screen.getByRole("button", { name: /commander \+/i }));
    await user.click(tile(ELVES.name));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /can't be a commander/i,
    );
  });
});

describe("DeckEditor — copy limits", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("caps an ordinary card at one copy in commander", async () => {
    const user = userEvent.setup();
    renderEditor({ format: "commander" });
    await waitForGrid(ELVES.name);

    await user.click(tile(ELVES.name));
    await waitFor(() => expect(badge(ELVES.name)).toBe("1"));

    await user.click(tile(ELVES.name));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /only one copy allowed/i,
    );
    expect(badge(ELVES.name)).toBe("1");
  });

  it("allows four copies in standard, then stops", async () => {
    const user = userEvent.setup();
    renderEditor({ format: "standard" });
    await waitForGrid(ELVES.name);

    for (let i = 0; i < 4; i++) await user.click(tile(ELVES.name));
    await waitFor(() => expect(badge(ELVES.name)).toBe("4"));

    await user.click(tile(ELVES.name));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /limit of 4 reached/i,
    );
    expect(badge(ELVES.name)).toBe("4");
  });

  it("does not cap basic lands", async () => {
    const user = userEvent.setup();
    renderEditor({ format: "commander" });
    await waitForGrid(FOREST.name);

    for (let i = 0; i < 5; i++) await user.click(tile(FOREST.name));

    await waitFor(() => expect(badge(FOREST.name)).toBe("5"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not cap a card that grants itself any number", async () => {
    const user = userEvent.setup();
    renderEditor({ format: "commander", results: [RATS] });
    await waitForGrid(RATS.name);

    for (let i = 0; i < 4; i++) await user.click(tile(RATS.name));

    await waitFor(() => expect(badge(RATS.name)).toBe("4"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables the + control on a deck row at its limit", async () => {
    const user = userEvent.setup();
    renderEditor({ format: "commander" });
    await waitForGrid(ELVES.name);

    await user.click(tile(ELVES.name));
    await waitFor(() => expect(badge(ELVES.name)).toBe("1"));

    const plus = await screen.findByRole("button", {
      name: new RegExp(`${ELVES.name} is at its copy limit`, "i"),
    });
    expect(plus).toBeDisabled();
  });
});

describe("DeckEditor — search failures", () => {
  it("shows an error and a retry rather than an empty grid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/cards/search")) {
          return new Response(
            JSON.stringify({ error: "Card search failed." }),
            {
              status: 503,
            },
          );
        }
        return new Response("[]", { status: 200 });
      }),
    );

    render(
      <DeckEditor
        deck={{
          id: "deck-1",
          name: "Test Deck",
          format: "commander",
          description: null,
          deck_cards: [],
        }}
        mode="local"
      />,
    );

    // A failed request must never render as "No cards found".
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/card search failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/no cards found/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
