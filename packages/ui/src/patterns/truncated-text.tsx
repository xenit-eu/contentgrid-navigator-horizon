import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../primitives/tooltip";

export interface TruncatedTextProps {
  readonly text: string;
  /** Characters shown before the text is truncated with "…"; the full text then shows on hover. */
  readonly maxCharLength?: number;
}

/**
 * `text` cut to `maxCharLength` characters plus "…" (without a space before it), or `text` itself
 * when it fits.
 */
function truncateText(text: string, maxCharLength: number | undefined): string {
  if (maxCharLength == null || text.length <= maxCharLength) {
    return text;
  }
  return `${text.slice(0, maxCharLength).trimEnd()}…`;
}

/**
 * Text truncated to `maxCharLength` characters, with the full text in a tooltip on hover. Text
 * within the limit renders as it is.
 */
function TruncatedText({ text, maxCharLength }: Readonly<TruncatedTextProps>) {
  const shown = truncateText(text, maxCharLength);
  if (shown === text) {
    return text;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{shown}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-80 break-words">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { TruncatedText, truncateText };
