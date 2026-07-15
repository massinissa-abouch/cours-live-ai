import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/library/$cycle")({
  component: () => <Outlet />,
});