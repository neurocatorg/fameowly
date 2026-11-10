"use client";

import { useState, useCallback } from "react";
import type { ModelOption, PendingAttachment, ImageHistoryItemClient } from "@/lib/types";
import { useImageOptions } from "./use-image-options";

interface UseImageGenerationParams {
  selectedImageModel: ModelOption;
  imageRefAttachments: PendingAttachment[];
  setImageRefAttachments: React.Dispatch<React.SetStateAction<PendingAttachment[]>>;
  loadImageHistory: () => Promise<void>;
  /** 402: the prompt and references stay for another try */
  onPaymentRequired?: (reason: string) => void;
}

export function useImageGeneration(params: UseImageGenerationParams) {
  const { selectedImageModel, imageRefAttachments, setImageRefAttachments, loadImageHistory, onPaymentRequired } = params;

  const [imagePrompt, setImagePrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const imageOptions = useImageOptions(selectedImageModel);
  const optionsBody = imageOptions.requestBody;
  const [selectedImageItem, setSelectedImageItem] = useState<ImageHistoryItemClient | null>(null);
  const [confirmDeleteImageId, setConfirmDeleteImageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImageGenerate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!imagePrompt.trim()) return;
      setImageLoading(true);
      setImageError("");
      setImageUrl(null);
      setSelectedImageItem(null);

      const refFiles = imageRefAttachments
        .filter((pa) => pa.uploaded)
        .map((pa) => ({
          url: pa.uploaded!.url,
          name: pa.uploaded!.name,
          mimeType: pa.uploaded!.mimeType,
          type: pa.uploaded!.type,
        }));

      let keepDraft = false;
      try {
        const res = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: imagePrompt,
            model: selectedImageModel.id,
            referenceFiles: refFiles.length ? refFiles : undefined,
            ...optionsBody,
          }),
        });
        const data = await res.json();
        if (res.status === 402 && onPaymentRequired) {
          keepDraft = true;
          onPaymentRequired(data.error || "Не хватает денег на этот ответ");
        } else if (!res.ok) {
          setImageError(data.error || "Ошибка генерации");
        } else {
          setImageUrl(data.imageUrl);
          if (data.historyItem) {
            setSelectedImageItem({ ...data.historyItem, createdAt: new Date(data.historyItem.createdAt) });
          }
        }
      } catch {
        setImageError("Ошибка сети");
      } finally {
        setImageLoading(false);
        if (!keepDraft) {
          setImageRefAttachments([]);
          setImagePrompt("");
        }
        await loadImageHistory();
      }
    },
    [imagePrompt, imageRefAttachments, selectedImageModel, optionsBody, setImageRefAttachments, loadImageHistory, onPaymentRequired]
  );

  const deleteImageHistoryItem = useCallback(
    async (id: string) => {
      try {
        await fetch("/api/images", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      } catch {
        // ignore
      }
      if (selectedImageItem?.id === id) {
        setSelectedImageItem(null);
        setImageUrl(null);
      }
      await loadImageHistory();
    },
    [selectedImageItem, loadImageHistory]
  );

  return {
    imagePrompt,
    setImagePrompt,
    imageUrl,
    setImageUrl,
    imageLoading,
    imageError,
    setImageError,
    imageOptions,
    selectedImageItem,
    setSelectedImageItem,
    confirmDeleteImageId,
    setConfirmDeleteImageId,
    previewImage,
    setPreviewImage,
    handleImageGenerate,
    deleteImageHistoryItem,
  };
}
