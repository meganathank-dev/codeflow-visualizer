import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Check, ChevronDown } from "lucide-react";

function findOptionIndex(options, value) {
  const index = options.findIndex((option) => Object.is(option.value, value));
  return index >= 0 ? index : 0;
}

export default function AccessibleSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
  menuAlign = "end",
  menuPlacement = "bottom",
  size = "regular"
}) {
  const listboxId = useId();
  const rootRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = useMemo(
    () => findOptionIndex(options, value),
    [options, value]
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const selectedOption = options[selectedIndex];
  const SelectedIcon = selectedOption?.icon;

  useEffect(() => {
    setActiveIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    if (!open) return undefined;

    function closeFromOutside(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.focus({ preventScroll: true });
  }, [activeIndex, open]);

  function choose(index) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
  }

  function moveActive(direction) {
    let next = activeIndex;
    do {
      next = (next + direction + options.length) % options.length;
    } while (options[next]?.disabled && next !== activeIndex);
    setActiveIndex(next);
  }

  function handleButtonKeyDown(event) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      if (event.key === "Home") setActiveIndex(0);
      else if (event.key === "End") setActiveIndex(options.length - 1);
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
    }
  }

  function handleOptionKeyDown(event, index) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(index);
      return;
    }

    if (event.key === "Escape" || event.key === "Tab") setOpen(false);
  }

  return (
    <div
      className={`accessible-select accessible-select-${size} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        className={open ? "accessible-select-trigger is-open" : "accessible-select-trigger"}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-activedescendant={open ? `${listboxId}-option-${activeIndex}` : undefined}
        disabled={disabled}
        onClick={() => {
          setActiveIndex(selectedIndex);
          setOpen((current) => !current);
        }}
        onKeyDown={handleButtonKeyDown}
      >
        {selectedOption?.color && (
          <span
            className="accessible-select-dot"
            style={{ "--option-color": selectedOption.color }}
            aria-hidden="true"
          />
        )}
        {SelectedIcon && <SelectedIcon size={15} aria-hidden="true" />}
        <span className="accessible-select-current">
          <strong>{selectedOption?.label}</strong>
          {selectedOption?.selectedDescription && (
            <small>{selectedOption.selectedDescription}</small>
          )}
        </span>
        <ChevronDown className="accessible-select-chevron" size={15} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={`accessible-select-menu is-aligned-${menuAlign} is-placed-${menuPlacement}`}
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => {
            const selected = Object.is(option.value, value);
            const OptionIcon = option.icon;
            return (
              <button
                className={selected ? "accessible-select-option is-selected" : "accessible-select-option"}
                id={`${listboxId}-option-${index}`}
                key={String(option.value)}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                tabIndex={index === activeIndex ? 0 : -1}
                ref={(element) => { optionRefs.current[index] = element; }}
                onClick={() => choose(index)}
                onFocus={() => setActiveIndex(index)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
              >
                {option.color && (
                  <span
                    className="accessible-select-dot"
                    style={{ "--option-color": option.color }}
                    aria-hidden="true"
                  />
                )}
                {OptionIcon && <OptionIcon size={16} aria-hidden="true" />}
                <span className="accessible-select-option-copy">
                  <strong>{option.label}</strong>
                  {option.description && <small>{option.description}</small>}
                </span>
                <Check className="accessible-select-check" size={15} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
