import { expect, it } from "vite-plus/test";
import { render } from "../../../test/render";
import { WebSearch } from "./web-search";

it("updates a native search and discloses only the sources the provider returned", async () => {
  await using screen = await render(<WebSearch patterns={["T3 Code"]} status="running" />);
  await screen.getByRole("button", { name: "Searching “T3 Code”" }).click();
  await expect.element(screen.getByRole("list", { name: "Web search sources" })).toBeVisible();

  await screen.rerender(
    <WebSearch
      patterns={["T3 Code"]}
      status="completed"
      results={[
        { title: "T3 Code", url: "https://t3.codes", snippet: "Coding agents" },
        { title: "Untrusted result", url: "javascript:alert(1)" },
      ]}
    />,
  );
  await expect.element(screen.getByRole("button", { name: "Searched 2 sources" })).toBeVisible();
  await expect
    .element(screen.getByRole("link", { name: /T3 Code/ }))
    .toHaveAttribute("href", "https://t3.codes/");
  await expect
    .element(screen.getByRole("link", { name: /Untrusted result/ }))
    .not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Searched 2 sources" }).click();
  await expect
    .element(screen.getByRole("list", { name: "Web search sources" }))
    .not.toBeInTheDocument();

  await screen.rerender(<WebSearch patterns={["T3 Code"]} status="interrupted" />);
  await expect.element(screen.getByRole("button", { name: "Search stopped" })).toBeVisible();
  await screen.rerender(<WebSearch patterns={["T3 Code"]} status="failed" />);
  await expect.element(screen.getByRole("button", { name: "Search failed" })).toBeDisabled();
  expect(
    screen.container.querySelector('[data-slot="web-search"]')?.getAttribute("data-status"),
  ).toBe("failed");
  await screen.rerender(<WebSearch status="waiting" />);
  await expect.element(screen.getByRole("button", { name: "Search waiting" })).toBeDisabled();
});
