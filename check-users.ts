import { db } from './src/lib/firebase';
import { collection, getDocs } from "firebase/firestore";

async function checkUsers() {
    console.log("Checking users...");
    try {
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);

        if (snapshot.empty) {
            console.log("No users found.");
            return;
        }

        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            role: doc.data().role,
            name: doc.data().name,
            email: doc.data().email
        }));

        console.log(JSON.stringify(users, null, 2));

    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

checkUsers();
