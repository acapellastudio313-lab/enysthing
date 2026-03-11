import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, onSnapshot, addDoc, serverTimestamp, orderBy, limit, increment, arrayUnion, arrayRemove, Timestamp, writeBatch } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { User, Post, Comment, Story, Candidate, LeaderboardEntry, Conversation, Message, Notification } from "../types";

/**
 * Reassembles a file from its chunks stored in Firestore.
 * @param fileId The ID of the file metadata
 * @returns A Blob URL representing the reassembled file
 */
export async function getFileFromChunks(fileId: string): Promise<string | null> {
  if (!fileId) return null;
  try {
    const metadataSnap = await getDoc(doc(db, "file_metadata", fileId));
    if (!metadataSnap.exists()) {
      console.error(`Metadata for file ${fileId} not found`);
      return null;
    }
    
    const { total_chunks, type } = metadataSnap.data();
    
    // Fetch all chunks for this file
    const chunksQuery = query(collection(db, "file_chunks"), where("file_id", "==", fileId));
    const chunksSnapshot = await getDocs(chunksQuery);
    
    if (chunksSnapshot.size < total_chunks) {
      console.warn(`File ${fileId} incomplete: ${chunksSnapshot.size}/${total_chunks} chunks.`);
      return null;
    }

    // Sort chunks by their index to ensure correct order
    const sortedChunks = chunksSnapshot.docs
      .map(d => d.data())
      .sort((a, b) => a.index - b.index);
      
    try {
      // Calculate total size and decode chunks individually
      let totalLength = 0;
      const decodedChunks = sortedChunks.map(c => {
        let base64 = c.data;
        // Handle potential data URL prefix for backward compatibility
        if (base64.includes(',')) {
          base64 = base64.split(',')[1];
        }
        // Remove any whitespace
        base64 = base64.trim().replace(/\s/g, '');
        
        // Handle URL-safe base64
        base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
        
        // Strip ALL non-alphabet characters including existing padding
        // atob is very picky about '=' only being at the end.
        base64 = base64.replace(/[^A-Za-z0-9+/]/g, '');
        
        // Add padding if necessary (base64 length must be multiple of 4)
        const remainder = base64.length % 4;
        if (remainder === 2) {
          base64 += '==';
        } else if (remainder === 3) {
          base64 += '=';
        } else if (remainder === 1) {
          // This is technically invalid base64, but we'll try to handle it by dropping the last char
          console.warn(`Chunk for file ${fileId} has invalid length (4n+1). Dropping last character.`);
          base64 = base64.slice(0, -1);
        }
        
        if (!base64) return new Uint8Array(0);

        try {
          // Use a more robust decoding approach
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          totalLength += bytes.length;
          return bytes;
        } catch (e) {
          // Log only the error message to avoid circular structure issues if e is complex
          console.error(`Failed to decode chunk for file ${fileId} (length: ${base64.length}):`, e instanceof Error ? e.message : String(e));
          return new Uint8Array(0);
        }
      });

      // Combine into a single Uint8Array
      const combinedArray = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of decodedChunks) {
        combinedArray.set(chunk, offset);
        offset += chunk.length;
      }
      
      const fileBlob = new Blob([combinedArray], { type: type || 'application/octet-stream' });
      return URL.createObjectURL(fileBlob);
    } catch (err) {
      console.error(`Error decoding base64 in getFileFromChunks for file ${fileId}:`, err);
      return null;
    }
  } catch (err) {
    console.error("Error fetching file chunks:", err);
    return null;
  }
}

// User Functions
export const getUser = async (id: string): Promise<User | null> => {
  const docRef = doc(db, "users", id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as User;
  }
  return null;
};

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const q = query(collection(db, "users"), where("username", "==", username));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as User;
  }
  return null;
};

export const initAdmin = async () => {
  try {
    const adminUser = await getUserByUsername('admin');
    if (!adminUser) {
      await setDoc(doc(db, "users", "admin"), {
        username: 'admin',
        password: 'admins',
        name: 'Administrator',
        role: 'admin',
        is_approved: 1,
        is_verified: 1,
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=random',
        join_date: new Date().toISOString(),
        bio: 'System Administrator'
      });
    }
  } catch (err) {
    console.error("Failed to init admin user", err);
  }
};

export const addVisitor = async (data: any) => {
  try {
    await addDoc(collection(db, "visitors"), {
      ...data,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to add visitor", err);
  }
};

// Settings
export const getSettings = async () => {
  const querySnapshot = await getDocs(collection(db, "settings"));
  const settings: Record<string, string> = {};
  querySnapshot.forEach((doc) => {
    settings[doc.id] = doc.data().value;
  });
  return settings;
};

export const updateSetting = async (key: string, value: string) => {
  await setDoc(doc(db, "settings", key), { value });
};

// File Chunking Helpers
const CHUNK_SIZE = 400 * 1024; // 400KB chunks to be safe (Firestore limit is 1MB)

export const uploadFileChunks = async (file: File, onProgress?: (progress: number) => void): Promise<string> => {
  const fileId = doc(collection(db, "file_metadata")).id;
  
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  
  const metadataRef = doc(db, "file_metadata", fileId);
  await setDoc(metadataRef, {
    name: file.name || 'unnamed_file',
    type: file.type || 'application/octet-stream',
    size: totalSize,
    total_chunks: totalChunks,
    created_at: serverTimestamp()
  });

  const uploadChunk = async (i: number) => {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const blob = file.slice(start, end);
    
    const base64Chunk = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/octet-stream;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    const chunkRef = doc(db, "file_chunks", `${fileId}_${i}`);
    await setDoc(chunkRef, {
      file_id: fileId,
      index: i,
      data: base64Chunk
    });
    
    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
  };

  // Upload in small batches
  const batchSize = 3;
  for (let i = 0; i < totalChunks; i += batchSize) {
    const batch = [];
    for (let j = 0; j < batchSize && i + j < totalChunks; j++) {
      batch.push(uploadChunk(i + j));
    }
    await Promise.all(batch);
  }

  return fileId;
};

export const uploadFile = uploadFileChunks;

export const deleteFileChunks = async (fileId: string) => {
  try {
    const batch = writeBatch(db);
    
    // Delete metadata
    batch.delete(doc(db, "file_metadata", fileId));
    
    // Delete chunks
    const q = query(collection(db, "file_chunks"), where("file_id", "==", fileId));
    const querySnapshot = await getDocs(q);
    querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
  } catch (error) {
    console.error("Error deleting file chunks:", error);
  }
};

export const uploadToStorage = async (file: File, path: string): Promise<string> => {
  try {
    const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading to Firebase Storage:", error);
    throw error;
  }
};

export const uploadBase64ToStorage = async (base64String: string, path: string): Promise<string> => {
  try {
    // Use fetch to handle Data URL conversion to Blob robustly if possible
    if (base64String.startsWith('data:')) {
      const response = await fetch(base64String);
      const blob = await response.blob();
      const mimeType = blob.type;
      const extension = mimeType.split('/')[1] || 'jpg';
      const file = new File([blob], `image_${Date.now()}.${extension}`, { type: mimeType });
      return await uploadToStorage(file, path);
    }

    // Fallback for raw base64
    let actualData = base64String.replace(/\s/g, '');
    
    // Handle URL-safe base64
    actualData = actualData.replace(/-/g, '+').replace(/_/g, '/');
    
    // Strip ALL non-alphabet characters including existing padding
    actualData = actualData.replace(/[^A-Za-z0-9+/]/g, '');
    
    // Add padding if necessary
    const remainder = actualData.length % 4;
    if (remainder === 2) {
      actualData += '==';
    } else if (remainder === 3) {
      actualData += '=';
    } else if (remainder === 1) {
      actualData = actualData.slice(0, -1);
    }

    const binaryString = atob(actualData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    const file = new File([blob], `image_${Date.now()}.jpg`, { type: 'image/jpeg' });
    
    return await uploadToStorage(file, path);
  } catch (error) {
    console.error("Error uploading base64 to Firebase Storage:", error);
    throw error;
  }
};

// Posts
export const createPost = async (postData: any) => {
  const docRef = await addDoc(collection(db, "posts"), {
    author_id: postData.author_id,
    content: postData.content,
    image_url: postData.image_url || null,
    image_file_id: postData.image_file_id || null,
    video_url: postData.video_url || null,
    video_file_id: postData.video_file_id || null,
    document_url: postData.document_url || null,
    document_file_id: postData.document_file_id || null,
    audio_url: postData.audio_url || null,
    audio_file_id: postData.audio_file_id || null,
    is_uploading: postData.is_uploading || false,
    upload_progress: postData.upload_progress || 0,
    created_at: serverTimestamp(),
    likes_count: 0,
    comments_count: 0,
    is_pinned: 0,
  });
  return docRef.id;
};

export const listenToPosts = (callback: (posts: Post[]) => void) => {
  const q = query(collection(db, "posts"), orderBy("created_at", "desc"));
  return onSnapshot(q, async (snapshot) => {
    const posts = await Promise.all(snapshot.docs.map(async (postDoc) => {
      const data = postDoc.data();
      const author = await getUser(data.author_id);
      return {
        id: postDoc.id,
        ...data,
        name: author?.name || "Unknown",
        avatar: author?.avatar || "",
        username: author?.username || "",
        created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Post;
    }));
    
    // Sort by pinned first
    posts.sort((a, b) => {
      if (a.is_pinned === 1 && b.is_pinned !== 1) return -1;
      if (a.is_pinned !== 1 && b.is_pinned === 1) return 1;
      return 0;
    });
    
    callback(posts);
  });
};

export const createNotification = async (userId: string, notification: any) => {
  await addDoc(collection(db, "users", userId, "notifications"), {
    ...notification,
    is_read: 0,
    created_at: serverTimestamp(),
  });
};

export const likePost = async (postId: string, userId: string) => {
  const likeRef = doc(db, "posts", postId, "likes", userId);
  const likeSnap = await getDoc(likeRef);
  
  const postRef = doc(db, "posts", postId);
  if (likeSnap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(postRef, { likes_count: increment(-1) });
  } else {
    await setDoc(likeRef, { created_at: serverTimestamp() });
    await updateDoc(postRef, { likes_count: increment(1) });
    
    // Send notification
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      const postData = postSnap.data();
      if (postData.author_id !== userId) {
        const user = await getUser(userId);
        if (user) {
          await createNotification(postData.author_id, {
            type: 'like',
            from_user_id: userId,
            from_user_name: user.name,
            from_user_avatar: user.avatar,
            post_id: postId,
            message: 'menyukai postingan Anda',
          });
        }
      }
    }
  }
};

export const getPostLikers = async (postId: string): Promise<User[]> => {
  const likeRef = collection(db, "posts", postId, "likes");
  const likeSnap = await getDocs(likeRef);
  
  if (likeSnap.empty) return [];

  const userIds = likeSnap.docs.map(doc => doc.id);
  const users = await Promise.all(userIds.map(id => getUser(id)));
  return users.filter(u => u !== null) as User[];
};

export const checkIsLiked = async (postId: string, userId: string) => {
  const likeRef = doc(db, "posts", postId, "likes", userId);
  const likeSnap = await getDoc(likeRef);
  return likeSnap.exists();
};

// Comments
export const addComment = async (postId: string, commentData: any) => {
  await addDoc(collection(db, "posts", postId, "comments"), {
    ...commentData,
    created_at: serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", postId), { comments_count: increment(1) });
  
  // Send notification
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const postData = postSnap.data();
    if (postData.author_id !== commentData.author_id) {
      const user = await getUser(commentData.author_id);
      if (user) {
        await createNotification(postData.author_id, {
          type: 'comment',
          from_user_id: commentData.author_id,
          from_user_name: user.name,
          from_user_avatar: user.avatar,
          post_id: postId,
          message: 'mengomentari postingan Anda',
        });
      }
    }
  }
};

export const listenToComments = (postId: string, callback: (comments: Comment[]) => void) => {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("created_at", "asc"));
  return onSnapshot(q, async (snapshot) => {
    const comments = await Promise.all(snapshot.docs.map(async (commentDoc) => {
      const data = commentDoc.data();
      const author = await getUser(data.author_id);
      return {
        id: commentDoc.id,
        ...data,
        name: author?.name || "Unknown",
        avatar: author?.avatar || "",
        username: author?.username || "",
        created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Comment;
    }));
    callback(comments);
  });
};

// Stories
export const createStory = async (storyData: any) => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  
  await addDoc(collection(db, "stories"), {
    ...storyData,
    created_at: serverTimestamp(),
    expires_at: Timestamp.fromDate(expiresAt),
  });
};

export const listenToStories = (callback: (stories: Story[]) => void) => {
  const now = Timestamp.now();
  const q = query(collection(db, "stories"), where("expires_at", ">", now), orderBy("expires_at", "asc"));
  return onSnapshot(q, async (snapshot) => {
    const stories = await Promise.all(snapshot.docs.map(async (storyDoc) => {
      const data = storyDoc.data();
      const author = await getUser(data.user_id);
      
      let mediaUrl = data.media_url;
      if (data.media_file_id) {
        const assembledUrl = await getFileFromChunks(data.media_file_id);
        if (assembledUrl) mediaUrl = assembledUrl;
      }

      return {
        id: storyDoc.id,
        ...data,
        media_url: mediaUrl,
        user_name: author?.name || "Unknown",
        user_avatar: author?.avatar || "",
        created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        expires_at: data.expires_at?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Story;
    }));
    callback(stories);
  });
};

export const deleteStory = async (storyId: string) => {
  try {
    const storyRef = doc(db, "stories", storyId);
    const storySnap = await getDoc(storyRef);
    if (storySnap.exists()) {
      const data = storySnap.data();
      if (data.media_file_id) {
        await deleteFileChunks(data.media_file_id);
      }
    }
    await deleteDoc(storyRef);
  } catch (error) {
    console.error("Error deleting story:", error);
    throw error;
  }
};

export const viewStory = async (storyId: string, userId: string) => {
  const user = await getUser(userId);
  if (!user) return;

  const viewData = {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    viewed_at: new Date().toISOString()
  };

  const storyRef = doc(db, "stories", storyId);
  const storySnap = await getDoc(storyRef);
  
  if (storySnap.exists()) {
    const data = storySnap.data();
    const views = data.views || [];
    // Check if user already viewed to avoid duplicates
    if (!views.some((v: any) => v.id === userId)) {
      await updateDoc(storyRef, {
        views: arrayUnion(viewData)
      });
    }
  }
};

// Realtime Listeners
export const listenToSettings = (callback: (settings: Record<string, string>) => void) => {
  return onSnapshot(collection(db, "settings"), (snapshot) => {
    const settings: Record<string, string> = {};
    snapshot.forEach((doc) => {
      settings[doc.id] = doc.data().value;
    });
    callback(settings);
  });
};

export const listenToNotifications = (userId: string, callback: (notifications: Notification[]) => void) => {
  const q = query(collection(db, "users", userId, "notifications"), orderBy("created_at", "desc"), limit(20));
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        created_at: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString()
      } as Notification;
    });
    callback(notifications);
  });
};

export const markNotificationsAsRead = async (userId: string) => {
  const q = query(collection(db, "users", userId, "notifications"), where("is_read", "==", 0));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.docs.forEach(doc => batch.update(doc.ref, { is_read: 1 }));
  await batch.commit();
};

export const notifyAllUsers = async (notificationData: any) => {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const batch = writeBatch(db);
    let count = 0;
    
    usersSnapshot.docs.forEach(userDoc => {
      const userRef = userDoc.ref;
      const notifRef = doc(collection(userRef, "notifications"));
      batch.set(notifRef, {
        ...notificationData,
        user_id: userDoc.id,
        created_at: serverTimestamp(),
        is_read: 0
      });
      count++;
    });
    
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error notifying all users:", error);
  }
};

export const triggerAppRefresh = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const batch = writeBatch(db);
    let count = 0;
    
    usersSnapshot.docs.forEach(userDoc => {
      const userData = userDoc.data();
      // Skip admins
      if (userData.role === 'admin') return;

      const userRef = userDoc.ref;
      const notifRef = doc(collection(userRef, "notifications"));
      batch.set(notifRef, {
        type: 'refresh',
        message: 'Aplikasi sedang diperbarui, memuat ulang...',
        user_id: userDoc.id,
        created_at: serverTimestamp(),
        is_read: 0
      });
      count++;
    });
    
    if (count > 0) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Error triggering app refresh:", error);
  }
};

export const notifyAdmins = async (notificationData: any) => {
  try {
    const adminsQuery = query(collection(db, "users"), where("role", "==", "admin"));
    const adminsSnapshot = await getDocs(adminsQuery);
    const batch = writeBatch(db);
    
    adminsSnapshot.docs.forEach(adminDoc => {
      const notifRef = doc(collection(adminDoc.ref, "notifications"));
      batch.set(notifRef, {
        ...notificationData,
        user_id: adminDoc.id,
        created_at: serverTimestamp(),
        is_read: 0
      });
    });
    await batch.commit();
  } catch (error) {
    console.error("Error notifying admins:", error);
  }
};

export const updatePost = async (postId: string, data: any) => {
  await updateDoc(doc(db, "posts", postId), {
    ...data,
    updated_at: serverTimestamp(),
  });
};

export const deletePost = async (postId: string) => {
  const postRef = doc(db, "posts", postId);
  const postSnap = await getDoc(postRef);
  if (postSnap.exists()) {
    const data = postSnap.data();
    if (data.image_file_id) await deleteFileChunks(data.image_file_id);
    if (data.video_file_id) await deleteFileChunks(data.video_file_id);
    if (data.document_file_id) await deleteFileChunks(data.document_file_id);
    if (data.audio_file_id) await deleteFileChunks(data.audio_file_id);
  }
  await deleteDoc(postRef);
};

export const deleteComment = async (postId: string, commentId: string) => {
  await deleteDoc(doc(db, "posts", postId, "comments", commentId));
  await updateDoc(doc(db, "posts", postId), { comments_count: increment(-1) });
};

export const updateComment = async (postId: string, commentId: string, data: any) => {
  await updateDoc(doc(db, "posts", postId, "comments", commentId), data);
};

export const search = async (queryText: string) => {
  const usersSnapshot = await getDocs(collection(db, "users"));
  const postsSnapshot = await getDocs(collection(db, "posts"));

  const lowerQuery = queryText.toLowerCase();

  const users = usersSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as User))
    .filter(u => u.name.toLowerCase().includes(lowerQuery) || u.username.toLowerCase().includes(lowerQuery));

  const posts = postsSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Post))
    .filter(p => p.content.toLowerCase().includes(lowerQuery));

  return { users, posts };
};

// Candidates
export const getCandidates = async (): Promise<Candidate[]> => {
  const querySnapshot = await getDocs(collection(db, "candidates"));
  const candidatesRaw = await Promise.all(querySnapshot.docs.map(async (doc) => {
    const data = doc.data();
    const user = await getUser(data.user_id);
    
    // If user doesn't exist anymore, delete this candidate and its votes
    if (!user) {
      const batch = writeBatch(db);
      batch.delete(doc.ref);
      const votesQuery = query(collection(db, "votes"), where("candidate_id", "==", doc.id));
      const votesSnapshot = await getDocs(votesQuery);
      votesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));
      await batch.commit();
      return null;
    }
    
    const votesQuery = query(collection(db, "votes"), where("candidate_id", "==", doc.id));
    const votesSnapshot = await getDocs(votesQuery);
    return {
      id: doc.id,
      ...data,
      name: user.name,
      avatar: user.avatar || "",
      username: user.username || "",
      vote_count: votesSnapshot.size,
    } as Candidate;
  }));
  
  return candidatesRaw.filter(c => c !== null) as Candidate[];
};

export const getMyVote = async (userId: string): Promise<{ candidate_id: string } | null> => {
  const q = query(collection(db, "votes"), where("user_id", "==", userId));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return { candidate_id: querySnapshot.docs[0].data().candidate_id };
  }
  return null;
};

export const castVote = async (userId: string, candidateId: string) => {
  const myVote = await getMyVote(userId);
  if (myVote) {
    throw new Error("Anda sudah memberikan suara");
  }
  await addDoc(collection(db, "votes"), {
    user_id: userId,
    candidate_id: candidateId,
    created_at: serverTimestamp(),
  });
};

// Leaderboard
export const getCandidateVoters = async (candidateId: string): Promise<User[]> => {
  const q = query(collection(db, "votes"), where("candidate_id", "==", candidateId));
  const querySnapshot = await getDocs(q);
  const userIds = querySnapshot.docs.map(doc => doc.data().user_id);
  
  if (userIds.length === 0) return [];

  const users = await Promise.all(userIds.map(id => getUser(id)));
  return users.filter(u => u !== null) as User[];
};

export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const candidates = await getCandidates();
  return candidates
    .map(c => ({
      id: c.id,
      name: c.name,
      avatar: c.avatar,
      username: c.username,
      vote_count: c.vote_count,
      rank: 0
    }))
    .sort((a, b) => b.vote_count - a.vote_count)
    .map((c, i) => ({ ...c, rank: i + 1 }));
};

export const getNonVoters = async (): Promise<User[]> => {
  const usersSnapshot = await getDocs(collection(db, "users"));
  const votesSnapshot = await getDocs(collection(db, "votes"));
  const votedUserIds = new Set(votesSnapshot.docs.map(doc => doc.data().user_id));
  
  return usersSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as User))
    .filter(user => !votedUserIds.has(user.id) && user.role !== 'admin');
};

export const updateUser = async (userId: string, data: Partial<User>) => {
  await updateDoc(doc(db, "users", userId), data);
};

export const updateCandidate = async (candidateId: string, data: Partial<Candidate>) => {
  await updateDoc(doc(db, "candidates", candidateId), data);
};

export const getPost = async (postId: string, userId: string): Promise<Post | null> => {
  const postDoc = await getDoc(doc(db, "posts", postId));
  if (!postDoc.exists()) return null;
  
  const data = postDoc.data();
  const author = await getUser(data.author_id);
  const isLiked = await checkIsLiked(postId, userId);
  
  return {
    id: postDoc.id,
    ...data,
    name: author?.name || "Unknown",
    avatar: author?.avatar || "",
    username: author?.username || "",
    is_liked: isLiked ? 1 : 0,
  } as Post;
};

export const pinPost = async (postId: string, isPinned: boolean) => {
  await updateDoc(doc(db, "posts", postId), { is_pinned: isPinned ? 1 : 0 });
};

// Messaging
export const getAllUsers = async (): Promise<User[]> => {
  const querySnapshot = await getDocs(collection(db, "users"));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
};

export const listenToConversations = (userId: string, callback: (conversations: Conversation[]) => void) => {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", userId),
    orderBy("last_message_time", "desc")
  );

  return onSnapshot(q, async (snapshot) => {
    const conversations = await Promise.all(snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const otherUserId = data.participants.find((id: string) => id !== userId);
      const otherUser = await getUser(otherUserId);
      return {
        id: otherUserId,
        name: otherUser?.name || "Unknown",
        username: otherUser?.username || "",
        avatar: otherUser?.avatar || "",
        last_message: data.last_message,
        last_message_time: data.last_message_time?.toDate?.()?.toISOString() || new Date().toISOString(),
        unread_count: data.unread_count?.[userId] || 0,
      } as Conversation;
    }));
    callback(conversations);
  });
};

export const listenToMessages = (userId: string, otherUserId: string, callback: (messages: Message[]) => void) => {
  const conversationId = [userId, otherUserId].sort().join("_");
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("created_at", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
    } as Message));
    callback(messages);
  });
};

export const sendMessage = async (userId: string, otherUserId: string, text: string, attachment?: { url: string | null, type: 'image' | 'video' | 'document', file_id?: string | null }) => {
  const conversationId = [userId, otherUserId].sort().join("_");
  const messageData = {
    sender_id: userId,
    receiver_id: otherUserId,
    text,
    attachment_url: attachment?.url || null,
    attachment_file_id: attachment?.file_id || null,
    attachment_type: attachment?.type || null,
    is_read: false,
    created_at: serverTimestamp(),
  };

  await addDoc(collection(db, "conversations", conversationId, "messages"), messageData);

  const convRef = doc(db, "conversations", conversationId);
  const convDoc = await getDoc(convRef);

  if (convDoc.exists()) {
    const data = convDoc.data();
    await updateDoc(convRef, {
      last_message: text || (attachment ? `[${attachment.type}]` : ''),
      last_message_time: serverTimestamp(),
      [`unread_count.${otherUserId}`]: increment(1),
    });
  } else {
    await setDoc(convRef, {
      participants: [userId, otherUserId],
      last_message: text || (attachment ? `[${attachment.type}]` : ''),
      last_message_time: serverTimestamp(),
      unread_count: {
        [otherUserId]: 1,
        [userId]: 0,
      },
    });
  }
};

export const markAsRead = async (userId: string, otherUserId: string) => {
  const conversationId = [userId, otherUserId].sort().join("_");
  const convRef = doc(db, "conversations", conversationId);
  const convDoc = await getDoc(convRef);
  
  if (convDoc.exists()) {
    await updateDoc(convRef, {
      [`unread_count.${userId}`]: 0,
    });
  }

  // Mark all unread messages from otherUserId as read
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const unreadQuery = query(
    messagesRef,
    where("sender_id", "==", otherUserId),
    where("is_read", "==", false)
  );
  
  const unreadDocs = await getDocs(unreadQuery);
  if (!unreadDocs.empty) {
    const batch = writeBatch(db);
    unreadDocs.forEach((doc) => {
      batch.update(doc.ref, { is_read: true });
    });
    await batch.commit();
  }
};

export const deleteMessage = async (userId: string, otherUserId: string, messageId: string) => {
  const conversationId = [userId, otherUserId].sort().join("_");
  await deleteDoc(doc(db, "conversations", conversationId, "messages", messageId));
};

export const deleteConversation = async (userId: string, otherUserId: string) => {
  const conversationId = [userId, otherUserId].sort().join("_");
  
  // Delete all messages in the conversation
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const messagesSnap = await getDocs(messagesRef);
  
  const batch = writeBatch(db);
  messagesSnap.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  // Delete the conversation document itself
  batch.delete(doc(db, "conversations", conversationId));
  
  await batch.commit();
};

// Admin
export const getStats = async () => {
  const users = await getDocs(collection(db, "users"));
  const posts = await getDocs(collection(db, "posts"));
  const votes = await getDocs(collection(db, "votes"));
  const candidates = await getDocs(collection(db, "candidates"));
  return {
    users: users.size,
    posts: posts.size,
    votes: votes.size,
    candidates: candidates.size,
  };
};

export const deleteUser = async (userId: string) => {
  const batch = writeBatch(db);
  
  // Delete user document
  batch.delete(doc(db, "users", userId));
  
  // Find and delete candidate if exists
  const candidateQuery = query(collection(db, "candidates"), where("user_id", "==", userId));
  const candidateSnapshot = await getDocs(candidateQuery);
  
  for (const candidateDoc of candidateSnapshot.docs) {
    batch.delete(candidateDoc.ref);
    
    // Delete all votes for this candidate
    const votesForCandidateQuery = query(collection(db, "votes"), where("candidate_id", "==", candidateDoc.id));
    const votesForCandidateSnapshot = await getDocs(votesForCandidateQuery);
    votesForCandidateSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));
  }
  
  // Delete user's own votes
  const userVotesQuery = query(collection(db, "votes"), where("user_id", "==", userId));
  const userVotesSnapshot = await getDocs(userVotesQuery);
  userVotesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));
  
  await batch.commit();
};

export const createUser = async (userData: any) => {
  const userRef = await addDoc(collection(db, "users"), {
    ...userData,
    created_at: serverTimestamp(),
  });
  return { id: userRef.id, ...userData };
};

export const addCandidate = async (userId: string, data: any) => {
  await addDoc(collection(db, "candidates"), {
    user_id: userId,
    ...data,
    created_at: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", userId), { role: "candidate" });
};

export const removeCandidate = async (candidateId: string, userId: string) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, "candidates", candidateId));
  if (userId && typeof userId === 'string' && userId.trim() !== '') {
    batch.update(doc(db, "users", userId), { role: "voter" });
  }
  
  // Delete all votes for this candidate
  const votesQuery = query(collection(db, "votes"), where("candidate_id", "==", candidateId));
  const votesSnapshot = await getDocs(votesQuery);
  votesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  
  await batch.commit();
};

export const resetVotes = async () => {
  const votesSnapshot = await getDocs(collection(db, "votes"));
  const batch = writeBatch(db);
  votesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
};

export const resetAllData = async () => {
  const collections = ["posts", "votes", "stories", "conversations", "notifications"];
  for (const collName of collections) {
    const snapshot = await getDocs(collection(db, collName));
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
};

export const sendSystemNotification = async (message: string) => {
  await notifyAllUsers({
    type: 'system',
    message,
    actor_name: 'Sistem',
    actor_avatar: 'https://ui-avatars.com/api/?name=Sistem&background=10b981&color=fff',
    link: '/'
  });
};

export const bulkDeleteUsers = async (userIds: string[]) => {
  for (const id of userIds) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", id));
    
    // Find and delete candidate if exists
    const candidateQuery = query(collection(db, "candidates"), where("user_id", "==", id));
    const candidateSnapshot = await getDocs(candidateQuery);
    
    for (const candidateDoc of candidateSnapshot.docs) {
      batch.delete(candidateDoc.ref);
      
      // Delete all votes for this candidate
      const votesForCandidateQuery = query(collection(db, "votes"), where("candidate_id", "==", candidateDoc.id));
      const votesForCandidateSnapshot = await getDocs(votesForCandidateQuery);
      votesForCandidateSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));
    }
    
    // Delete user's own votes
    const userVotesQuery = query(collection(db, "votes"), where("user_id", "==", id));
    const userVotesSnapshot = await getDocs(userVotesQuery);
    userVotesSnapshot.docs.forEach(voteDoc => batch.delete(voteDoc.ref));
    
    await batch.commit();
  }
};

export const bulkApproveUsers = async (userIds: string[]) => {
  for (const id of userIds) {
    const batch = writeBatch(db);
    batch.update(doc(db, "users", id), { is_approved: 1 });
    await batch.commit();
  }
};

export const bulkDeleteCandidates = async (candidateIds: string[], candidatesData: any[]) => {
  for (const id of candidateIds) {
    const batch = writeBatch(db);
    batch.delete(doc(db, "candidates", id));
    
    // Find candidate data to get user_id
    const candidate = candidatesData.find(c => c.id === id);
    if (candidate && candidate.user_id && typeof candidate.user_id === 'string' && candidate.user_id.trim() !== '') {
      batch.update(doc(db, "users", candidate.user_id), { role: "voter" });
    }
    
    // Delete all votes for this candidate
    const votesQuery = query(collection(db, "votes"), where("candidate_id", "==", id));
    const votesSnapshot = await getDocs(votesQuery);
    votesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
  }
};

// Gallery Functions
export const addGalleryImage = async (userId: string, imageUrl: string, caption: string) => {
  const newImageRef = doc(collection(db, "gallery_images"));
  await setDoc(newImageRef, {
    user_id: userId,
    image_url: imageUrl,
    caption,
    created_at: serverTimestamp()
  });
  return newImageRef.id;
};

export const listenToGalleryImages = (userId: string, callback: (images: any[]) => void) => {
  const q = query(
    collection(db, "gallery_images"),
    where("user_id", "==", userId),
    orderBy("created_at", "desc")
  );
  
  return onSnapshot(q, (snapshot) => {
    const images = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate().toISOString() || new Date().toISOString()
    }));
    callback(images);
  });
};

export const updateGalleryImageCaption = async (imageId: string, caption: string) => {
  const imageRef = doc(db, "gallery_images", imageId);
  await updateDoc(imageRef, { caption });
};

export const deleteGalleryImage = async (imageId: string) => {
  await deleteDoc(doc(db, "gallery_images", imageId));
};
