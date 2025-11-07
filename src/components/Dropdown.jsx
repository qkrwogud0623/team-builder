/**
 * @file Dropdown.jsx
 * @description 재사용 가능한 범용 드롭다운 컴포넌트입니다.
 * [리팩토링]
 * - CSS 모듈을 적용하여 스타일 독립성을 확보했습니다.
 * - 키보드 접근성을 개선했습니다.
 * - [수정] export default -> export const 로 변경하여 named import가 가능하도록 수정했습니다.
 * - [버그 수정] JSX와 CSS 모듈의 클래스 이름 불일치 문제를 해결했습니다.
 */
import React, { useState, useEffect, useRef } from 'react';
import styles from './Dropdown.module.css';

export const Dropdown = ({ options, placeholder, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleSelect = (val) => {
    onChange?.(val);
    setIsOpen(false);
  };

  const handleKeyDown = (e, val) => {
    if (e.key === 'Enter' || e.key === ' ') {
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
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    // [수정] styles.dropdown -> styles.dropdownContainer
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <button
        type="button"
        // [수정] styles.header -> styles.dropdownHeader
        className={styles.dropdownHeader}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {value ? (
          // [수정] styles.value -> styles.dropdownValue
          <span className={styles.dropdownValue}>{value}</span>
        ) : (
          <span className={styles.placeholder}>{placeholder || '선택...'}</span>
        )}
        <span className={`${styles.arrow} ${isOpen ? styles.up : styles.down}`} />
      </button>

      {isOpen && (
        // [수정] styles.list -> styles.dropdownList
        <ul className={styles.dropdownList} role="listbox">
          {options.map((opt) => (
            <li
              key={opt}
              role="option"
              aria-selected={opt === value}
              // [수정] styles.item -> styles.dropdownItem
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