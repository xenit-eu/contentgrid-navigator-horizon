import { createRouter } from "@tanstack/react-router";
import { useProfile } from "@contentgrid/navigator-data";
import { EntityOverview } from "@contentgrid/views/entity-overview";

export const page = [EntityOverview, createRouter, useProfile];
