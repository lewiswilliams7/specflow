/** Shown the moment a page in the app is opened, while its data loads. */
export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-block" />
      <div className="skeleton skeleton-block short" />
    </div>
  );
}
