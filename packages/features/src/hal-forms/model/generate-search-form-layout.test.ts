import { describe, expect, it } from "vitest";
import {
  type HalFormsProperty,
  SearchHalFormTemplate,
  resolveTemplate,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { generateSearchFormLayout } from "./generate-search-form-layout";
import type { HalFormsField } from "./hal-forms-field";

const PROFILE_URL = "https://example.com/profile/tasks";

const taskProfileJson = {
  name: "task",
  description: "",
  _links: {
    self: { href: PROFILE_URL },
    describes: [
      { href: "https://example.com/tasks", name: "collection" },
      { href: "https://example.com/tasks/{id}", name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _embedded: {
    "blueprint:attribute": [
      {
        name: "status",
        title: "Status",
        type: "string",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "status", title: "Status", type: "exact-match" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "due_date",
        title: "Due date",
        type: "datetime",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "due_date", title: "Due date", type: "exact-match" },
            { name: "due_date~after", title: "Due date after", type: "greater-than" },
            { name: "due_date~before", title: "Due date before", type: "less-than" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
      {
        name: "priority",
        title: "Priority",
        type: "long",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "priority~gte", title: "Priority from", type: "greater-than-or-equal" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [
      {
        name: "assignee",
        title: "Assignee",
        description: "The user this task is assigned to",
        many_source_per_target: true,
        many_target_per_source: false,
        required: false,
        _links: { "blueprint:target-entity": { href: "https://example.com/profile/users" } },
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: "https://example.com/tasks", properties: [] },
    "create-form": { method: "POST", target: "https://example.com/tasks", properties: [] },
    search: {
      method: "GET",
      target: "https://example.com/tasks",
      properties: [
        { name: "status", type: "text" },
        { name: "due_date", type: "datetime" },
        { name: "due_date~after", type: "datetime" },
        { name: "due_date~before", type: "datetime" },
        { name: "priority~gte", type: "number" },
        { name: "assignee.name~prefix", type: "text" },
        { name: "assignee.email", type: "text" },
      ],
    },
  },
};

function makeSearchTemplate() {
  const profile = makeProfileEntity(taskProfileJson, PROFILE_URL, "task");
  const rawTemplate = resolveTemplate(
    taskProfileJson as unknown as Parameters<typeof resolveTemplate>[0],
    "search",
  )!;
  return new SearchHalFormTemplate(rawTemplate, profile);
}

const DUMMY_PROPERTY = {} as unknown as HalFormsProperty;

function textField(name: string, label: string): HalFormsField {
  return {
    name,
    label,
    required: false,
    readOnly: false,
    kind: "text",
    property: DUMMY_PROPERTY,
  };
}

describe("generateSearchFormLayout", () => {
  it("pairs two direction-labeled siblings sharing a groupKey into one row", () => {
    const fields = [
      textField("status", "Status"),
      textField("due_date~after", "Due date after"),
      textField("due_date~before", "Due date before"),
      textField("priority~gte", "Priority from"),
    ];
    const layout = generateSearchFormLayout(makeSearchTemplate(), fields);
    const pairedRow = layout.sections[0].rows.find((row) => row.fieldNames.length === 2);
    expect(pairedRow?.fieldNames).toEqual(["due_date~after", "due_date~before"]);
  });

  it("gives a property with only one range variant its own full-width row", () => {
    const fields = [
      textField("status", "Status"),
      textField("due_date~after", "Due date after"),
      textField("due_date~before", "Due date before"),
      textField("priority~gte", "Priority from"),
    ];
    const layout = generateSearchFormLayout(makeSearchTemplate(), fields);
    expect(layout.sections[0].rows).toContainEqual({ fieldNames: ["priority~gte"] });
  });

  it("gives a plain (non-range) property its own full-width row, in fields order", () => {
    const fields = [
      textField("status", "Status"),
      textField("due_date~after", "Due date after"),
      textField("due_date~before", "Due date before"),
      textField("priority~gte", "Priority from"),
    ];
    const layout = generateSearchFormLayout(makeSearchTemplate(), fields);
    expect(layout.sections[0].rows[0]).toEqual({ fieldNames: ["status"] });
  });

  it("gives a datetime attribute's exact-match field its own row, directly above its paired range row", () => {
    const fields = [
      textField("status", "Status"),
      textField("due_date", "Due date"),
      textField("due_date~after", "Due date after"),
      textField("due_date~before", "Due date before"),
      textField("priority~gte", "Priority from"),
    ];
    const layout = generateSearchFormLayout(makeSearchTemplate(), fields);
    expect(layout.sections[0].rows).toEqual([
      { fieldNames: ["status"] },
      { fieldNames: ["due_date"] },
      { fieldNames: ["due_date~after", "due_date~before"] },
      { fieldNames: ["priority~gte"] },
    ]);
  });

  it("only pairs fields that are actually present, ignoring a range sibling that didn't survive", () => {
    const fields = [textField("status", "Status"), textField("due_date~after", "Due date after")];
    const layout = generateSearchFormLayout(makeSearchTemplate(), fields);
    expect(layout.sections[0].rows).toEqual([
      { fieldNames: ["status"] },
      { fieldNames: ["due_date~after"] },
    ]);
  });

  it("groups relation-traversal properties into their own collapsible section, named for the relation", () => {
    const fields = [
      textField("status", "Status"),
      textField("assignee.name~prefix", "Assignee name"),
      textField("assignee.email", "Assignee email"),
    ];
    const layout = generateSearchFormLayout(makeSearchTemplate(), fields);

    expect(layout.sections).toHaveLength(2);
    expect(layout.sections[1]).toMatchObject({
      title: "Assignee",
      description: "The user this task is assigned to",
      isCollapsible: true,
    });
    expect(layout.sections[1].rows).toEqual([
      { fieldNames: ["assignee.name~prefix"] },
      { fieldNames: ["assignee.email"] },
    ]);
  });

  it("keeps direct properties in a plain, non-collapsible leading section alongside a relation section", () => {
    const fields = [
      textField("status", "Status"),
      textField("assignee.name~prefix", "Assignee name"),
    ];
    const layout = generateSearchFormLayout(makeSearchTemplate(), fields);

    expect(layout.sections[0]).toEqual({ rows: [{ fieldNames: ["status"] }] });
  });

  it("omits the leading direct section entirely when every property is relation-scoped", () => {
    const fields = [textField("assignee.name~prefix", "Assignee name")];
    const layout = generateSearchFormLayout(makeSearchTemplate(), fields);

    expect(layout.sections).toHaveLength(1);
    expect(layout.sections[0]).toMatchObject({ title: "Assignee", isCollapsible: true });
  });
});
