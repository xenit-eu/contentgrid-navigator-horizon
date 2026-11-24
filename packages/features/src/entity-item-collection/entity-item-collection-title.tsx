import { type ProfileEntity, useEntityItemCollection } from "@contentgrid/navigator-data";
import { type CountLike, formatCount } from "@contentgrid/ui";

export interface EntityItemCollectionTitleProps {
  readonly profile: ProfileEntity;
  /** The total of the shown search (filtered when filters are active); `undefined` when unknown. */
  readonly total: CountLike | undefined;
  /** Whether a search or filter is active; adds the "Filtered from N items" line. */
  readonly isFiltered: boolean;
}

/**
 * The collection page's heading: the entity's plural name with its item count as a pill. While a
 * search or filter is active, a muted line under it gives the unfiltered total. A count the API
 * doesn't give shows nothing, no placeholder.
 */
export function EntityItemCollectionTitle({
  profile,
  total,
  isFiltered,
}: Readonly<EntityItemCollectionTitleProps>) {
  const count = formatCount(total, { estimate: "word" });

  return (
    <div className="px-4">
      <div className="flex items-center gap-2.5">
        <h1 className="text-[26px] leading-[1.2] font-bold text-foreground">
          {profile.pluralName}
        </h1>
        {count !== undefined && (
          <span
            data-slot="collection-count"
            className="inline-grid h-6 min-w-[22px] place-items-center rounded-full border bg-muted px-[7px] text-[13px] font-bold text-muted-foreground"
          >
            {count}
          </span>
        )}
      </div>
      {isFiltered && <UnfilteredTotalLine profile={profile} />}
    </div>
  );
}

/**
 * "Filtered from 1 284 items". Reads the entity's unfiltered first page with the very query
 * (same key and options) the sidebar's count and Home's cards run, so it is fetched once per
 * entity and shared through the cache. Only mounted while filtering, so an unfiltered list asks
 * nothing extra.
 */
function UnfilteredTotalLine({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const { data } = useEntityItemCollection(
    { profileEntity: profile },
    { queryOptionsOverride: { refetchOnWindowFocus: false, refetchOnMount: false } },
  );
  const total = data?.totalItems;
  const count = formatCount(total, { estimate: "word" });
  if (!total || count === undefined) return null;

  return (
    <p className="text-sm text-muted-foreground">
      Filtered from {count} {total.count === 1 && !total.isEstimated ? "item" : "items"}
    </p>
  );
}
