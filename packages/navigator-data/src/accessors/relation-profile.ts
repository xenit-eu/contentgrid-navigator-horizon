import type { HalObject, Link } from "@contentgrid/hal";
import { blueprintRels } from "../api";
import type { ProfileRelationShape } from "../shapes";
import type Profile from "./entity-profile";

export class ProfileRelation {
  constructor(private readonly hal: HalObject<ProfileRelationShape>) {}

  private get relationProfileData(): ProfileRelationShape {
    return this.hal.data;
  }

  // ========================================
  // Basic Properties
  // ========================================

  get name(): string {
    return this.relationProfileData.name;
  }

  get title(): string {
    return this.relationProfileData.title ?? this.name;
  }

  get description(): string {
    return this.relationProfileData.description;
  }

  get isRequired(): boolean {
    return this.relationProfileData.required;
  }

  // ========================================
  // Cardinality
  // ========================================

  get isToMany(): boolean {
    return this.relationProfileData.many_target_per_source;
  }

  get isToOne(): boolean {
    return !this.relationProfileData.many_target_per_source;
  }

  get isManyToMany(): boolean {
    return (
      this.relationProfileData.many_source_per_target &&
      this.relationProfileData.many_target_per_source
    );
  }

  get isManyToOne(): boolean {
    return (
      this.relationProfileData.many_source_per_target &&
      !this.relationProfileData.many_target_per_source
    );
  }

  get isOneToMany(): boolean {
    return (
      !this.relationProfileData.many_source_per_target &&
      this.relationProfileData.many_target_per_source
    );
  }

  get isOneToOne(): boolean {
    return (
      !this.relationProfileData.many_source_per_target &&
      !this.relationProfileData.many_target_per_source
    );
  }

  // ========================================
  // Target Entity
  // ========================================

  get targetProfileLink(): Link | null {
    return this.hal.links.findLink(blueprintRels["target-entity"]);
  }

  get targetProfileHref(): string | undefined {
    return this.targetProfileLink?.href;
  }

  get targetProfileTitle(): string | undefined {
    return this.targetProfileLink?.title;
  }

  /**
   * Find the target profile from an already-loaded list of profiles.
   *
   * Matches by the profile's own link href (the `cg:entity` link href from the profile
   * root), which is the same URL the `blueprint:target-entity` relation link points to.
   * Using `profile.describes()` does not work here: `describes` links contain collection
   * and item URL patterns (e.g. `/products`, `/products/{id}`), not the profile URL itself.
   */
  public getTargetProfile(profiles: readonly Profile[]): Profile | undefined {
    const targetProfileLink = this.targetProfileLink;
    if (!targetProfileLink) return undefined;
    return profiles.find((profile) => profile.link.href === targetProfileLink.href);
  }
}
