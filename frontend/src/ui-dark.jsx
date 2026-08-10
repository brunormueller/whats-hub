import { useState } from "react";

/* Tokens do design escuro "Atende IA" — landing e telas de sessão.
   Cores literais de propósito: essas telas não seguem o data-theme do
   painel, o design não prevê variação claro/escuro fora dele. */

export const JAK = "'Plus Jakarta Sans',sans-serif";
export const MONO = "'IBM Plex Mono',monospace";

export const HOVER_GHOST = { background: "rgba(255,255,255,.06)" };
export const HOVER_PRI = { background: "#54E7A8" };
export const HOVER_LINK = { color: "#B6F2D6" };
export const HOVER_CARD = {
  border: "1px solid rgba(61,220,151,.3)",
  background: "linear-gradient(180deg,#131B17,#0D1210)",
};

export const btnPri = (padding, size, shadow) => ({
  padding,
  border: 0,
  borderRadius: 12,
  background: "#3DDC97",
  color: "#06110B",
  font: `700 ${size}px/1 ${JAK}`,
  boxShadow: shadow,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export const btnGhost = (padding, size) => ({
  padding,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.14)",
  background: "transparent",
  color: "#E8EFEA",
  font: `600 ${size}px/1 ${JAK}`,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export const inputDark = {
  width: "100%",
  boxSizing: "border-box",
  padding: "13px 14px",
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,.11)",
  background: "#101614",
  color: "#E8EFEA",
  font: `400 14.5px/1 ${JAK}`,
  outline: "none",
};

export const inputFocus = {
  border: "1px solid rgba(61,220,151,.55)",
  background: "#121A16",
};

/** Marca "A" em gradiente. */
export function Mark({ size = 30, radius = 9, font = 13 }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "linear-gradient(150deg,#3DDC97,#1E8F63)",
        display: "grid",
        placeItems: "center",
        font: `800 ${font}px/1 ${JAK}`,
        color: "#06110B",
      }}
    >
      A
    </span>
  );
}

/** Input escuro com o realce de foco do design (style-focus). */
export function DarkInput({ style, onFocus, onBlur, ...rest }) {
  const [focus, setFocus] = useState(false);
  return (
    <input
      {...rest}
      style={{ ...inputDark, ...(focus ? inputFocus : null), ...style }}
      onFocus={(e) => {
        setFocus(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        onBlur?.(e);
      }}
    />
  );
}
