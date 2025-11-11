import React from 'react';
import styles from './SplashScreen.module.css';
import logo from '../logo.svg';

/**
 * Displays the Balance splash overlay while the app boots up.
 */
function SplashScreen() {
  return (
    <div className={styles.splash} role="status" aria-live="assertive">
      <div className={styles.logoWrap}>
        <div className={styles.logoBadge}>
          <img src={logo} alt="Balance logo" className={styles.logo} />
        </div>
        <p className={styles.brand}>
          BAL<span className={styles.brandAccent}>ANCE</span>
        </p>
        <p className={styles.tagline}>Team Builder</p>
      </div>
      <div className={styles.spinner} aria-hidden="true" />
    </div>
  );
}

export default SplashScreen;