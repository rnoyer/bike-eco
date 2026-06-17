import { initializeApp } from "firebase/app";

// Optionally import the services that you want to use
// import {...} from 'firebase/auth';
// import {...} from 'firebase/database';
// import {...} from 'firebase/firestore';
// import {...} from 'firebase/functions';
import { getStorage } from "firebase/storage";
// Import the functions you need from the SDKs you need

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCybLCVKrcssoW9YfyFN4Dl7RrOH2YwIMM",
  authDomain: "bike-eco-641ed.firebaseapp.com",
  projectId: "bike-eco-641ed",
  storageBucket: "bike-eco-641ed.firebasestorage.app",
  messagingSenderId: "671158589631",
  appId: "1:671158589631:web:c0dae01529043978be4e0a",
  measurementId: "G-L56NFYCBCL",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
