Save the three scene images into this folder using these exact filenames:

  background.png    -> the full sunlit forest scene (Image 1)
  middleground.png  -> the dark / silhouette layer (Image 3)
  foreground.png    -> the foliage with transparent center (Image 2)

The layers stack farthest -> closest:
  background  (z-index 1)
  middleground (z-index 2)
  foreground  (z-index 3)

If your files are .jpg or .webp instead of .png, either:
  - rename them to the .png filenames above, OR
  - update the three <img src="..."> paths inside "Start Game.html".
