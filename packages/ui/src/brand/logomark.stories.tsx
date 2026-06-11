import type { Meta, StoryObj } from "@storybook/react";
import { LogomarkColor, LogomarkDiap } from "./logomark";

const meta = {
  title: "Brand/Logomark",
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Color: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      <LogomarkColor size={32} />
      <LogomarkColor size={48} />
      <LogomarkColor size={64} />
    </div>
  ),
};

export const Diap: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        alignItems: "center",
        background: "#084772",
        padding: "1rem",
        borderRadius: "0.5rem",
      }}
    >
      <LogomarkDiap size={32} />
      <LogomarkDiap size={48} />
      <LogomarkDiap size={64} />
    </div>
  ),
};
