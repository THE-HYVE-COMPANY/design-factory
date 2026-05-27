// DirectionTrigger.tsx — Single-line trigger in create form. Opens DirectionModal.
//
// Both empty and filled states show ONE label: "Escolher Formato e Direção".
// Filled state adds a subtle accent dot + count to signal there's a selection.
// All summary/details live INSIDE the modal — trigger stays clean.

import {
  getFormatoById,
  type DirectionSelection,
} from "@/data/direction-data";

interface Props {
  selection: DirectionSelection | null;
  onOpen: () => void;
}

const Plus = () => (
  <svg className="dt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const Check = () => (
  <svg className="dt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ChevronRight = () => (
  <svg className="dt-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export function DirectionTrigger({ selection, onOpen }: Props) {
  const filled = !!selection && !!getFormatoById(selection.formatoId);

  return (
    <button
      type="button"
      className={`dt-trigger ${filled ? "is-filled" : "is-empty"}`}
      onClick={onOpen}
    >
      {filled ? <Check /> : <Plus />}
      <span className="dt-name">Pick format &amp; direction</span>
      <ChevronRight />
    </button>
  );
}
