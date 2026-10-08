"use client";

import { Children, Fragment, isValidElement, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import ReactSelect, { components, type DropdownIndicatorProps, type OptionProps, type StylesConfig } from "react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; disabled: boolean };
type Change = { target: { value: string; name?: string }; currentTarget: { value: string; name?: string } };
type SearchSelectProps = {
  children: ReactNode;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: Change) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  placeholder?: string;
  searchPlaceholder?: string;
  noOptionsMessage?: string;
  isClearable?: boolean;
  styles?: StylesConfig<Option, false>;
};

function textContent(children: ReactNode): string {
  return Children.toArray(children).map(child => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    return isValidElement<{ children?: ReactNode }>(child) ? textContent(child.props.children) : "";
  }).join("");
}

// Preserve each screen's existing option values, event handlers and permissions.
function collectOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode; value?: string | number; disabled?: boolean }>(child)) return [];
    if (child.type === Fragment || child.type === "optgroup") return collectOptions(child.props.children);
    if (child.type !== "option") return [];
    const label = textContent(child.props.children).replace(/\s+/g, " ").trim();
    return [{ value: String(child.props.value ?? label), label, disabled: Boolean(child.props.disabled) }];
  });
}

function DropdownIndicator(props: DropdownIndicatorProps<Option, false>) {
  return <components.DropdownIndicator {...props}><ChevronDown className="size-4" /></components.DropdownIndicator>;
}

function SelectOption(props: OptionProps<Option, false>) {
  return <components.Option {...props}><span className="min-w-0 flex-1">{props.label}</span>{props.isSelected && <Check className="size-4 shrink-0" aria-hidden="true" />}</components.Option>;
}

/** Searchable single-select. Customize labels, empty results, clearing and styles per screen. */
export function SearchSelect({ children, value, defaultValue, onChange, id, name, disabled, required, className, style, placeholder, searchPlaceholder = "Type to search…", noOptionsMessage = "No matching options", isClearable = false, styles, ...aria }: SearchSelectProps) {
  const generatedId = useId();
  const options = useMemo(() => collectOptions(children), [children]);
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const selectedValue = String(value ?? uncontrolledValue);
  const selected = options.find(option => option.value === selectedValue) ?? null;
  const emptyOption = options.find(option => option.value === "");
  const filterControl = className?.includes("!w-auto");

  return (
    <div style={style} className={cn("search-select", filterControl && "search-select-filter", className?.replace(/\bfield\b|!w-auto|!min-h-9|!py-1\.5|!text-xs/g, ""))}>
      <ReactSelect<Option, false>
        instanceId={generatedId}
        inputId={id ?? `${generatedId}-input`}
        name={name}
        unstyled
        classNamePrefix="bulk-select"
        options={options}
        value={required && selected?.value === "" ? null : selected}
        onChange={next => {
          const nextValue = next?.value ?? "";
          setUncontrolledValue(nextValue);
          setSearch("");
          const target = { value: nextValue, name };
          onChange?.({ target, currentTarget: target });
        }}
        inputValue={search}
        onInputChange={setSearch}
        onMenuOpen={() => setMenuOpen(true)}
        onMenuClose={() => { setMenuOpen(false); setSearch(""); }}
        menuIsOpen={menuOpen}
        controlShouldRenderValue={!menuOpen}
        isSearchable
        isClearable={isClearable}
        isDisabled={disabled}
        isOptionDisabled={option => option.disabled}
        required={required}
        placeholder={menuOpen ? searchPlaceholder : placeholder ?? emptyOption?.label ?? "Select an option"}
        noOptionsMessage={() => noOptionsMessage}
        menuPlacement="auto"
        maxMenuHeight={240}
        menuShouldScrollIntoView
        components={{ DropdownIndicator, Option: SelectOption, IndicatorSeparator: null }}
        screenReaderStatus={({ count }) => `${count} options available. Type to search and use arrow keys to choose.`}
        classNames={{
          control: state => cn("bulk-select-control", state.isFocused && "is-focused", state.isDisabled && "is-disabled"),
          option: state => cn("bulk-select-option", state.isSelected && "is-selected", state.isFocused && "is-focused", state.isDisabled && "is-disabled"),
        }}
        styles={styles}
        aria-label={aria["aria-label"] ?? (!aria["aria-labelledby"] && !id ? emptyOption?.label ?? "Select an option" : undefined)}
        aria-labelledby={aria["aria-labelledby"]}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"]}
      />
    </div>
  );
}
