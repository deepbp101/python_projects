import { useEffect, useState } from "react";
import {
  Image,
  Platform,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from "react-native";
import { API_URL, readToken } from "~/api";

/**
 * An image from the access-checked `/api/files/:id` route.
 *
 * Uploads are never static assets — the route checks the session before it
 * serves a byte, which is what stops a guest's photo staying reachable once the
 * couple hides it. So the image request needs the same bearer the API does, and
 * there are two ways to attach one:
 *
 *  - Native: `source={{ uri, headers }}`, which iOS and Android both honour.
 *  - Web: react-native-web ignores `headers`, so the request goes out bare and
 *    401s. There the bytes are fetched with the header and handed over as an
 *    object URL instead.
 *
 * Web is only the development preview, but an image that silently shows nothing
 * there is an image nobody can check.
 */
export function AuthedImage({
  uploadId,
  style,
  accessibilityLabel,
}: {
  uploadId: string;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}) {
  const [source, setSource] = useState<ImageSourcePropType | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      const token = await readToken();
      if (!token || cancelled) return;
      const uri = `${API_URL}/api/files/${uploadId}`;

      if (Platform.OS !== "web") {
        setSource({ uri, headers: { Authorization: `Bearer ${token}` } });
        return;
      }

      try {
        const response = await fetch(uri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok || cancelled) return;
        objectUrl = URL.createObjectURL(await response.blob());
        setSource({ uri: objectUrl });
      } catch {
        // A missing image is a gap in a gallery, never a crash.
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uploadId]);

  // Renders the styled box either way, so a gallery does not reflow as images
  // arrive one by one.
  return (
    <Image
      source={source ?? { uri: undefined }}
      style={style}
      resizeMode="cover"
      accessibilityLabel={accessibilityLabel}
    />
  );
}
