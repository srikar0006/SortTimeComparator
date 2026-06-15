import {
  Component,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Navigate, NavLink, Outlet, Route, Routes, useParams } from "react-router-dom";

const API_URL = "https://sort-time-comparor-python-server.vercel.app/api/compare";
const STORAGE_KEY = "algorithm-last-result";

const algorithms = {
  "bubble-sort": {
    title: "Bubble Sort",
    complexity: "O(n^2)",
    text: "Bubble Sort compares nearby values repeatedly, so it slows down as the list grows.",
  },
  "merge-sort": {
    title: "Merge Sort",
    complexity: "O(n log n)",
    text: "Merge Sort splits the list into smaller parts, sorts those parts, and merges them back.",
  },
};

const AppContext = createContext(null);

export function parseNumbers(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number);
}

export function validateNumbers(value) {
  const numbers = parseNumbers(value);

  if (numbers.length < 2) return "Enter at least two numbers separated by commas.";
  if (numbers.some(Number.isNaN)) return "Only numbers are allowed.";

  return "";
}

export function getSpeedMessage(result) {
  const bubbleTime = result.bubbleSort.elapsedMs;
  const mergeTime = result.mergeSort.elapsedMs;

  if (bubbleTime === mergeTime) return "Both algorithms took the same time.";

  const bubbleIsFaster = bubbleTime < mergeTime;
  const fasterName = bubbleIsFaster ? "Bubble Sort" : "Merge Sort";
  const slowerName = bubbleIsFaster ? "Merge Sort" : "Bubble Sort";
  const fasterTime = Math.max(Math.min(bubbleTime, mergeTime), 0.00001);
  const slowerTime = Math.max(bubbleTime, mergeTime);

  return `${fasterName} was ${(slowerTime / fasterTime).toFixed(2)} times faster than ${slowerName}.`;
}

function randomNumbers(size) {
  return Array.from({ length: size }, () => Math.floor(Math.random() * 10000));
}

function readStoredResult() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : null;
}

function AppProvider({ children }) {
  const [lastResult, setLastResult] = useState(readStoredResult);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lastResult));
  }, [lastResult]);

  const bestAlgorithm = useMemo(() => {
    if (!lastResult) return "No result yet";

    return lastResult.bubbleSort.elapsedMs < lastResult.mergeSort.elapsedMs
      ? "Bubble Sort"
      : "Merge Sort";
  }, [lastResult]);

  const appState = { lastResult, setLastResult, bestAlgorithm };

  return <AppContext.Provider value={appState}>{children}</AppContext.Provider>;
}

function useAppState() {
  return useContext(AppContext);
}

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    return this.state.hasError ? <Fallback /> : this.props.children;
  }
}

export function Fallback() {
  return (
    <main className="app-shell">
      <section className="panel">
        <h1>Something went wrong</h1>
        <p>Please refresh and try again.</p>
      </section>
    </main>
  );
}

function Layout() {
  const { bestAlgorithm } = useAppState();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Sort Time Comparator</h1>
          <p>Fastest in last run: {bestAlgorithm}</p>
        </div>

        <nav>
          <NavLink to="/">Compare</NavLink>
          <NavLink to="/last-result">Last Result</NavLink>
          <NavLink to="/algorithm/bubble-sort">Bubble Sort</NavLink>
          <NavLink to="/algorithm/merge-sort">Merge Sort</NavLink>
        </nav>
      </header>

      <Outlet />
    </main>
  );
}

function ProtectedRoute({ children }) {
  const { lastResult } = useAppState();
  return lastResult ? children : <Navigate to="/" replace />;
}

function ComparePage() {
  const [numbersText, setNumbersText] = useState('');
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const randomSizeRef = useRef(null);
  const { setLastResult } = useAppState();

  function updateNumbers(event) {
    const nextValue = event.target.value;
    setNumbersText(nextValue);
    setError(validateNumbers(nextValue));
  }

  function fillRandomNumbers() {
    const size = Number(randomSizeRef.current.value);
    setNumbersText(randomNumbers(size).join(", "));
    setError("");
  }

  async function submitNumbers(event) {
    event.preventDefault();

    const validationMessage = validateNumbers(numbersText);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numbers: parseNumbers(numbersText) }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Backend error");

      const savedResult = { ...data, createdAt: new Date().toLocaleString() };
      setResult(savedResult);
      setLastResult(savedResult);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page-grid">
      <CompareForm
        error={error}
        isLoading={isLoading}
        numbersText={numbersText}
        randomSizeRef={randomSizeRef}
        onGenerateRandom={fillRandomNumbers}
        onNumbersChange={updateNumbers}
        onSubmit={submitNumbers}
      />
      <ResultView result={result} />
    </div>
  );
}

function LastResultPage() {
  const { lastResult } = useAppState();
  return <ResultView result={lastResult} />;
}

function AlgorithmPage() {
  const { name } = useParams();
  const detail = algorithms[name] || algorithms["bubble-sort"];

  return (
    <section className="panel">
      <h2>{detail.title}</h2>
      <p className="big-complexity">{detail.complexity}</p>
      <p>{detail.text}</p>
    </section>
  );
}

function CompareForm({
  error,
  isLoading,
  numbersText,
  randomSizeRef,
  onGenerateRandom,
  onNumbersChange,
  onSubmit,
}) {
  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <label htmlFor="numbers">Numbers</label>
      <textarea
        id="numbers"
        value={numbersText}
        onChange={onNumbersChange}
        placeholder="Example: 10, 4, 7, 1, 9"
      />
      {error && <p className="error">{error}</p>}

      <label htmlFor="random-size">Generate random input</label>
      <select id="random-size" ref={randomSizeRef} defaultValue="" onChange={onGenerateRandom}>
        <option value="" disabled>
          Select size
        </option>
        <option value="5">5 numbers (quick)</option>
        <option value="100">100 numbers (small)</option>
        <option value="1000">1000 numbers (medium)</option>
        <option value="5000">5000 numbers (large)</option>
      </select>

      <button type="submit" disabled={isLoading}>
        {isLoading ? "Comparing" : "Compare"}
      </button>
    </form>
  );
}

function ResultView({ result }) {
  if (!result) {
    return (
      <section className="panel empty-state">
        <h2>No comparison yet</h2>
        <p>Enter numbers and click compare.</p>
      </section>
    );
  }

  const bubbleTime = result.bubbleSort.elapsedMs;
  const mergeTime = result.mergeSort.elapsedMs;
  const maxTime = Math.max(bubbleTime, mergeTime, 1);

  return (
    <section className="panel">
      <h2>Output</h2>
      <p>Input size: {result.inputSize}</p>

      <div className="time-graph" aria-label="Sorting time graph">
        <GraphRow label="Bubble Sort" time={bubbleTime} maxTime={maxTime} barClassName="bubble-bar" />
        <GraphRow label="Merge Sort" time={mergeTime} maxTime={maxTime} barClassName="merge-bar" />
      </div>

      <p className="speed-message">{getSpeedMessage(result)}</p>

      <div className="results-grid">
        <AlgorithmCard algorithm={result.bubbleSort} />
        <AlgorithmCard algorithm={result.mergeSort} />
      </div>

      <p className="sorted">
        Sorted preview: {result.sortedNumbers.slice(0, 40).join(", ")}
        {result.sortedNumbers.length > 40 ? " ..." : ""}
      </p>
    </section>
  );
}

function GraphRow({ label, time, maxTime, barClassName }) {
  const width = Math.max((time / maxTime) * 100, 4);

  return (
    <div className="graph-row">
      <span>{label}</span>
      <div className="graph-track">
        <div className={`graph-bar ${barClassName}`} style={{ width: `${width}%` }} />
      </div>
      <strong>{time} ms</strong>
    </div>
  );
}

function AlgorithmCard({ algorithm }) {
  return (
    <article>
      <h3>{algorithm.name}</h3>
      <strong>{algorithm.timeComplexity}</strong>
      <span>{algorithm.elapsedMs} ms</span>
    </article>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<ComparePage />} />
            <Route path="algorithm">
              <Route index element={<Navigate to="bubble-sort" replace />} />
              <Route path=":name" element={<AlgorithmPage />} />
            </Route>
            <Route
              path="last-result"
              element={
                <ProtectedRoute>
                  <LastResultPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </ErrorBoundary>
  );
}
