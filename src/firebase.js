// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCSI3fz-q0yaaOKhjdSIz0-2GLxXbSlSnU",
    authDomain: "balance-app-789fc.firebaseapp.com",
    projectId: "balance-app-789fc",
    storageBucket: "balance-app-789fc.firebasestorage.app",
    messagingSenderId: "715855398123",
    appId: "1:715855398123:web:5550df6e662206bf14aaae"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);