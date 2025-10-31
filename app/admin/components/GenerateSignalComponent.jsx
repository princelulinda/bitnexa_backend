import React, { useEffect } from 'react'
import { Box, Button, Text } from '@adminjs/design-system'
import { useNavigate } from 'react-router-dom'
import axios from 'axios' // Re-import axios

const GenerateSignalComponent = (props) => {
  const { record } = props // Destructure record from props
  const navigate = useNavigate()

  // Placeholder for sendNotice - will be replaced once found
  const sendNotice = (notice) => {
    console.log('Notice:', notice.message, notice.type)
    alert(notice.message) // Fallback to alert for now
  }

  useEffect(() => {
    console.log('GenerateSignalComponent props:', props)
    console.log('Record from props:', record)
  }, [props, record])

  const handleGenerateSignal = async () => {
    if (!record || !record.id) {
      console.error('Record or record ID is missing.')
      sendNotice({
        message: "Impossible de trouver l'ID du plan.",
        type: 'error',
      })
      return
    }

    try {
      const response = await axios.post(
        `/admin/api/plans/${record.id}/generate-signal`,
        {},
        {
          withCredentials: true, // Send cookies for session auth
          // No CSRF token header, assuming it's not needed or handled implicitly
        }
      )

      sendNotice({
        message: response.data.message || 'Signal généré avec succès !',
        type: 'success',
      })
      navigate(0)
    } catch (error) {
      console.error('Erreur lors de la génération du signal:', error)
      sendNotice({
        message: error.response?.data?.message || 'Échec de la génération du signal.',
        type: 'error',
      })
    }
  }

  return (
    <Box>
      <Button onClick={handleGenerateSignal} variant="primary">
        Générer un Signal
      </Button>
      <Text mt="default" variant="sm">
        Cliquez pour générer un signal unique pour ce plan.
      </Text>
    </Box>
  )
}

export default GenerateSignalComponent
