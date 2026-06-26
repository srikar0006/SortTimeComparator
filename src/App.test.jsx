import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { getSpeedMessage, parseNumbers, validateNumbers } from "./App.jsx";

function renderApp(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("unit tests", () => {
  it("parses comma separated numbers", () => {
    expect(parseNumbers("3, 1, 2")).toEqual([3, 1, 2]);
  });

  it("validates controlled form input", () => {
    expect(validateNumbers("3, hello")).toBe("Only numbers are allowed.");
    expect(validateNumbers("3")).toBe("Enter at least two numbers separated by commas.");
    expect(validateNumbers("3, 1")).toBe("");
  });

  it("builds the speed message from result data", () => {
    const result = {
      bubbleSort: { elapsedMs: 0.3 },
      mergeSort: { elapsedMs: 0.1 },
    };

    expect(getSpeedMessage(result)).toBe("Merge Sort was 3.00 times faster than Bubble Sort.");
  });
});

describe("integration test", () => {
  it("submits numbers, shows output, and stores the last result", async () => {
    const responseData = {
      inputSize: 3,
      sortedNumbers: [1, 2, 3],
      bubbleSort: {
        name: "Bubble Sort",
        timeComplexity: "O(n^2)",
        elapsedMs: 0.3,
      },
      mergeSort: {
        name: "Merge Sort",
        timeComplexity: "O(n log n)",
        elapsedMs: 0.1,
      },
    };
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responseData),
      }),
    );

    renderApp();

    await userEvent.clear(screen.getByLabelText(/numbers/i));
    await userEvent.type(screen.getByLabelText(/numbers/i), "3, 1, 2");
    await userEvent.click(screen.getByRole("button", { name: /compare/i }));

    expect(await screen.findByText("O(n^2)")).toBeInTheDocument();
    expect(screen.getByText("O(n log n)")).toBeInTheDocument();
    expect(screen.getByText("Merge Sort was 3.00 times faster than Bubble Sort.")).toBeInTheDocument();
    expect(localStorage.getItem("algorithm-last-result")).toContain('"inputSize":3');
    expect(global.fetch).toHaveBeenCalledWith(
      "https://sort-time-comparor-python-server.vercel.app/api/compare",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("generates random numbers from the selected size", async () => {
    renderApp();

    await userEvent.selectOptions(screen.getByLabelText(/generate random input/i), "5");

    expect(screen.getByLabelText(/numbers/i).value.split(", ")).toHaveLength(5);
    expect(screen.getByRole("option", { name: "5000 numbers (large)" })).toBeInTheDocument();
  });
});
