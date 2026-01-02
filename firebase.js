import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, Timestamp, query, where, orderBy, limit, getDocs } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3gQMnJh0L8Bc6CNRJ_oTh6xqabVP2-P4",
  authDomain: "crime-rate-anaylsis.firebaseapp.com",
  projectId: "crime-rate-anaylsis",
  storageBucket: "crime-rate-anaylsis.firebasestorage.app",
  messagingSenderId: "640438558864",
  appId: "1:640438558864:web:42745954d83ea46cecf815"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, doc, setDoc, getDoc, collection, addDoc, Timestamp, query, where, orderBy, limit, getDocs };