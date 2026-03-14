import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export const sendNotification = async (userId: string, message: string, link: string) => {
  try {
    await addDoc(collection(db, 'users', userId, 'notifications'), {
      user_id: userId,
      type: 'system',
      message,
      link,
      is_read: 0,
      created_at: serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
