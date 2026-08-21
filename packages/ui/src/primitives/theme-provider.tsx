import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

function ThemeProvider({ children, ...props }: Readonly<ThemeProviderProps>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
export type { ThemeProviderProps };
