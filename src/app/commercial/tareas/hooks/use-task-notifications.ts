"use client";

import { useEffect, useState, useCallback } from 'react';
import { TaskNotification } from '@/types/commercial';
import { getUserNotifications, deleteNotification } from '@/lib/commercial-api';
import { onSnapshot, query, collection, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useTaskNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Cargar notificaciones iniciales
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const notifs = await getUserNotifications(userId);
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.read).length);
      } catch (error) {
        console.error("Error loading notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, [userId]);

  // Suscribirse a nuevas notificaciones en tiempo real
  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'task_notifications'),
      where('userId', '==', userId),
      where('expiresAt', '>', Timestamp.now()),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TaskNotification[];
      
      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.read).length);
    }, (error) => {
      console.error("Error in notifications subscription:", error);
    });

    return () => unsubscribe();
  }, [userId]);

  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (error) {
      console.error("Error dismissing notification:", error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    dismissNotification
  };
}
