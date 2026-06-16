import type { HalObject, Link } from "@contentgrid/hal";
import { blueprintRels } from "../api";
import type { ProfileRelationShape } from "../shapes";
import type Profile from "./entity-profile";

export class ProfileRelation {
  constructor(private readonly hal: HalObject<ProfileRelationShape>) {}

  private get relationProfileData(): ProfileRelationShape {
    return this.hal.data as ProfileRelationShape;
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

  get targetProfileLink(): Link | undefined {
    return this.hal.links.findLinks(blueprintRels["target-entity"])[0];
  }

  get targetProfileHref(): string | undefined {
    return this.targetProfileLink?.href;
  }

  get targetProfileTitle(): string | undefined {
    return this.targetProfileLink?.title;
  }

  /**
   * Find the target profile from an already-loaded list of profiles.
   * More efficient when profiles are pre-loaded.
   */
  public getTargetProfile(profiles: readonly Profile[]): Profile | null {
    const targetProfile = this.targetProfileLink;
    if (targetProfile) {
      return profiles.find((profile) => profile.describes(targetProfile)) ?? null;
    }
    return null;
  }
}
