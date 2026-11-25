import { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AbsoluteDateAttributeRenderer } from "./absolute-date-attribute-renderer";

export interface DateAttributeRendererProps {
  readonly value: string | null;
  readonly wrap?: boolean;
}

export function DateAttributeRenderer({ value, wrap }: Readonly<DateAttributeRendererProps>) {
  return (
    <AbsoluteDateAttributeRenderer value={value} wrap={wrap} type={ProfileAttributeType.date} />
  );
}
