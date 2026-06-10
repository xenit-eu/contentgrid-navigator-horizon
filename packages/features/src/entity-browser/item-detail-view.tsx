// TODO(HZN-5.2): implement full item detail/edit UI
export function ItemDetailView({ collection, id }: Readonly<{ collection: string; id: string }>) {
  return (
    <div className="p-6">
      <p className="text-muted-foreground text-sm">
        Item: {collection} / {id}
      </p>
    </div>
  );
}
