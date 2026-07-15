import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/library/$cycle/$levelSlug")({
  component: () => <Outlet />,
});