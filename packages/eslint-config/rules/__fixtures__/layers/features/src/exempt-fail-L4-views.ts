import { useBlocker } from "@tanstack/react-router";
import { EntityOverview } from "@contentgrid/views/entity-overview";

export const guard = [useBlocker, EntityOverview];
