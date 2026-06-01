import { Card, CardContent, CardHeader, CardTitle } from "@contentgrid/ui";

export function EntityList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entities</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Entity list will render here once navigator-data hooks are wired.
        </p>
      </CardContent>
    </Card>
  );
}
