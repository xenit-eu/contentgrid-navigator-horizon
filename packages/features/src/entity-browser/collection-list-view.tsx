// TODO(HZN-5.1): implement full collection list UI (search, filter, table, pagination)
export function CollectionListView({ collection }: Readonly<{ collection: string }>) {
  return (
    <div className="p-6">
      <p className="text-muted-foreground text-sm">Collection: {collection}</p>
    </div>
  );
}
