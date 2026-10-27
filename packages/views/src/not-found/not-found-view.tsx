import { NotFoundPage } from "@contentgrid/features/app-info-pages";
import { useViewNavigation } from "../navigation";

/** The page shown when no route matches; "Back to home" goes through the navigation context. */
export function NotFoundView() {
  const navigation = useViewNavigation();
  return <NotFoundPage onBackHome={() => navigation.openHome()} />;
}
