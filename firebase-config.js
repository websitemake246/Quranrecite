// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Auth functions
function signUp(email, password, userData) {
    return auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            // Add user data to Firestore
            return db.collection('users').doc(userCredential.user.uid).set({
                ...userData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                defaultReciter: userData.defaultReciter || '1',
                bookmarks: [],
                history: [],
                settings: {
                    theme: 'light',
                    fontSize: 18,
                    language: 'en'
                }
            });
        });
}

function signIn(email, password) {
    return auth.signInWithEmailAndPassword(email, password);
}

function signOut() {
    return auth.signOut();
}

function getCurrentUser() {
    return auth.currentUser;
}

// User preferences
async function getUserPreferences(userId) {
    const doc = await db.collection('users').doc(userId).get();
    return doc.data();
}

async function updateDefaultReciter(userId, reciterId) {
    return db.collection('users').doc(userId).update({
        defaultReciter: reciterId
    });
}

async function addBookmark(userId, surahNo, ayahNo) {
    const userRef = db.collection('users').doc(userId);
    return userRef.update({
        bookmarks: firebase.firestore.FieldValue.arrayUnion({
            surah: surahNo,
            ayah: ayahNo,
            timestamp: new Date()
        })
    });
}

async function addToHistory(userId, surahNo, ayahNo) {
    const userRef = db.collection('users').doc(userId);
    return userRef.update({
        history: firebase.firestore.FieldValue.arrayUnion({
            surah: surahNo,
            ayah: ayahNo,
            timestamp: new Date()
        })
    });
}
