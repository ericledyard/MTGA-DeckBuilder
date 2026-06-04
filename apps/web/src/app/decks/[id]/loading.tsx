export default function DeckLoading() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 animate-pulse">
      <div className="lg:w-80 xl:w-96 shrink-0">
        <div className="bg-gray-900 border border-gray-800 rounded-xl h-64" />
      </div>
      <div className="flex-1 flex flex-col gap-4">
        <div className="h-8 bg-gray-800 rounded w-48" />
        <div className="h-28 bg-gray-900 border border-gray-800 rounded-xl" />
        <div className="h-16 bg-gray-900 border border-gray-800 rounded-xl" />
        <div className="h-64 bg-gray-900 border border-gray-800 rounded-xl" />
      </div>
    </div>
  );
}
