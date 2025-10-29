import app from '@adonisjs/core/services/app'
import SocketIoService from '#services/SocketIoService'

const connectedUsers = new Map<string, any>() // stocke les utilisateurs connectés (socket.id => info utilisateur)

app.ready(() => {
  SocketIoService.setIo()
  const io = SocketIoService.io

  io?.on('connection', (socket) => {
    console.log(`Nouvelle connexion : ${socket.id}`)

    // Optionnel : tu peux récupérer le nom depuis la query ou un event d'identification
    const username = socket.handshake.query.username || `User-${socket.id.slice(0, 5)}`

    // Ajout de l'utilisateur connecté
    connectedUsers.set(socket.id, { id: socket.id, name: username })

    // Envoie au client la liste et le nombre des utilisateurs connectés
    io.emit('connected_users', {
      count: connectedUsers.size,
      users: Array.from(connectedUsers.values())
    })

    // Événement test
    socket.emit('message', JSON.stringify({ name: 'John' }))

    // Quand un utilisateur se déconnecte
    socket.on('disconnect', () => {
      console.log(`Déconnexion : ${socket.id}`)
      connectedUsers.delete(socket.id)

      // Met à jour la liste des utilisateurs pour tous les clients
      io.emit('connected_users', {
        count: connectedUsers.size,
        users: Array.from(connectedUsers.values())
      })
    })
  })
})
