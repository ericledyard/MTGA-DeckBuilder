import type { Metadata } from "next";
import { BuilderDeckEditor } from "@/components/builder/BuilderDeckEditor";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "Stateless Deck Builder",
};

// No auth gate and no database read: the deck lives in the visitor's browser,
// so all this route does is hand the id to the client.
export default async function BuilderDeckPage({ params }: Props) {
  const { id } = await params;
  return <BuilderDeckEditor deckId={id} />;
}
