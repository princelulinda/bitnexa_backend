import React, { useState, useEffect } from 'react'
import { Box, Label, Input, Button, Text } from '@adminjs/design-system'
import axios from 'axios'

const ImageUploadComponent = (props) => {
  const { property, record, onChange } = props
  const [previewImage, setPreviewImage] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('useEffect triggered. record.params[property.name]:', record.params[property.name])
    if (record.params[property.name]) {
      setPreviewImage(record.params[property.name])
    }
  }, [record.params[property.name]])

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreviewImage(URL.createObjectURL(selectedFile))
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier.')
      return
    }

    setUploading(true)
    setError(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      // Assuming you have an endpoint for image upload
      const response = await axios.post('/announcements/upload-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      const imageUrl = response.data.imageUrl
      console.log('Image uploaded successfully. imageUrl:', imageUrl)
      onChange(property.name, imageUrl)
      console.log('onChange called with property.name:', property.name, 'and imageUrl:', imageUrl)
      setUploading(false)
      // Optionally, clear the file input after successful upload
      setFile(null)
    } catch (err) {
      console.error("Erreur lors de l'upload de l'image", err)
      setError("Échec de l'upload de l'image.")
      setUploading(false)
    }
  }

  const handleRemoveImage = async () => {
    // For simplicity, this example just clears the image from the form
    // In a real application, you might want to send a request to delete the file from the server
    setPreviewImage(null)
    onChange(property.name, null)
    setFile(null)
  }

  return (
    <Box>
      <Label>{property.label}</Label>
      {previewImage && (
        <Box mb="default">
          <img src={previewImage} alt="Aperçu" style={{ maxWidth: '100%', height: 'auto' }} />
          <Button onClick={handleRemoveImage} variant="danger" size="sm" mt="default">
            Supprimer l'image
          </Button>
        </Box>
      )}
      <Input type="file" onChange={handleFileChange} disabled={uploading} />
      <Button onClick={handleUpload} disabled={!file || uploading} mt="default">
        {uploading ? 'Téléchargement...' : "Télécharger l'image"}
      </Button>
      {error && (
        <Text mt="default" color="danger">
          {error}
        </Text>
      )}
      {record.params[property.name] && !previewImage && (
        <Text mt="default">Image actuelle: {record.params[property.name]}</Text>
      )}
    </Box>
  )
}

export default ImageUploadComponent
