import { db } from './src/lib/firebase';
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";

async function fixPermissions() {
    console.log("Starting permission fix...");
    try {
        const usersCol = collection(db, 'users');
        const snapshot = await getDocs(usersCol);

        snapshot.docs.forEach(async (userDoc) => {
            const data = userDoc.data();
            console.log(`Checking user: ${data.email} (${userDoc.id}) - Current Role: ${data.role}`);

            // Target specific user to promote
            if (data.email === 'jhoanamotta@adma.com.co') {
                console.log(`Updating role for ${data.email} to 'commercial_director'...`);
                await updateDoc(doc(db, 'users', userDoc.id), {
                    role: 'commercial_director'
                });
                console.log("Success! Role updated.");
            }
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

fixPermissions();
