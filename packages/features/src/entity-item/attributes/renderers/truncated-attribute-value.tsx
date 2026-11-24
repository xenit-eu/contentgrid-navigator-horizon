import {
  AttributeValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@contentgrid/ui";

export interface TruncatedAttributeValueProps {
  readonly text: string | undefined;
  /** Characters shown before the text is truncated with "…"; the full text then shows on hover. */
  readonly maxCharLength?: number;
  readonly wrap?: boolean;
}

/** A text value truncated to `maxCharLength` characters, with the full text in a tooltip on hover. */
export function TruncatedAttributeValue({
  text,
  maxCharLength,
  wrap,
}: Readonly<TruncatedAttributeValueProps>) {
  const isTruncated = text != null && maxCharLength != null && text.length > maxCharLength;
  if (!isTruncated) {
    return <AttributeValue wrap={wrap}>{text}</AttributeValue>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <AttributeValue wrap={wrap}>{`${text.slice(0, maxCharLength)}…`}</AttributeValue>
        </TooltipTrigger>
        <TooltipContent className="max-w-80 break-words">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
