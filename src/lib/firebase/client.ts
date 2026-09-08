"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";
import { firebaseWebConfig } from "./config";

export function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(firebaseWebConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

let db: Firestore | undefined;

export function getDb() {
  if (db) return db;
  const app = getFirebaseApp();
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }
  return db;
}

export function getBucket() {
  return getStorage(getFirebaseApp());
}

export function getFns() {
  return getFunctions(getFirebaseApp());
}

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider("apple.com");
appleProvider.addScope("email");
appleProvider.addScope("name");
