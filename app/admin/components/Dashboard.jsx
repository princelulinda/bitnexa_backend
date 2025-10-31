import React from 'react'
import {
  Box,
  H1,
  H2,
  Text,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@adminjs/design-system'

const Dashboard = (props) => {
  const {
    totalUsers,
    totalWallets,
    totalTransactions,
    totalDeposits,
    last5Users,
    last5Transactions,
    tvl,
    error,
  } = props

  if (error) {
    return (
      <Box>
        <H1>Dashboard</H1>
        <Text color="red">{error}</Text>
      </Box>
    )
  }

  return (
    <Box>
      <H1 mb="xl">Dashboard</H1>
      <Box display="flex" flexWrap="wrap" mx={-2}>
        <Box width={[1, 1 / 2, 1 / 4]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
            <Text>Total Users</Text>
            <H2>{totalUsers}</H2>
          </Box>
        </Box>
        <Box width={[1, 1 / 2, 1 / 4]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
            <Text>Total Wallets</Text>
            <H2>{totalWallets}</H2>
          </Box>
        </Box>
        <Box width={[1, 1 / 2, 1 / 4]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
            <Text>Total Transactions</Text>
            <H2>{totalTransactions}</H2>
          </Box>
        </Box>
        <Box width={[1, 1 / 2, 1 / 4]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
            <Text>Total Deposits</Text>
            <H2>{totalDeposits} USDT</H2>
          </Box>
        </Box>
        <Box width={[1, 1 / 2, 1 / 4]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
            <Text>Total Value Locked</Text>
            <H2>{tvl} USDT</H2>
          </Box>
        </Box>
      </Box>

      <Box display="flex" flexWrap="wrap" mx={-2} mt={4}>
        <Box width={[1, 1, 1 / 2]} p={2}>
          <H2>Last 5 Users</H2>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {last5Users &&
                  last5Users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell>{user.email}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
        <Box width={[1, 1, 1 / 2]} p={2}>
          <H2>Last 5 Transactions</H2>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {last5Transactions &&
                  last5Transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.id}</TableCell>
                      <TableCell>{tx.amount}</TableCell>
                      <TableCell>{tx.type}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard
