/**
 * 옵션 목록을 선택할 수 있는 공통 드롭다운 컴포넌트다.
 */
import React, { useState, useEffect, useRef } from "react";
import styles from "./Dropdown.module.css";

// 옵션 목록과 키보드 접근성을 지원한다.
export const Dropdown = ({ options, placeholder, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleSelect = (val) => {
    onChange?.(val);
    setIsOpen(false);
  };

  const handleKeyDown = (e, val) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(val);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button
        type="button"
        className={styles.dropdownHeader}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {value ? (
          <span className={styles.dropdownValue}>{value}</span>
        ) : (
          <span className={styles.placeholder}>{placeholder || "선택..."}</span>
        )}
        <span
          className={`${styles.arrow} ${isOpen ? styles.up : styles.down}`}
        />
      </button>

      {isOpen && (
        <ul className={styles.dropdownList} role="listbox">
          {options.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              className={styles.dropdownItem}
              onClick={() => handleSelect(opt)}
              onKeyDown={(e) => handleKeyDown(e, opt)}
              tabIndex={0}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
