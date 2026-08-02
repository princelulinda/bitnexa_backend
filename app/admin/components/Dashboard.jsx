import React from 'react'
import {
  Box,
  H1,
  H2,
  H3,
  Text,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@adminjs/design-system'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from 'recharts'

const Dashboard = (props) => {
  const {
    totalUsers,
    totalWallets,
    totalTransactions,
    totalDeposits,
    last5Users,
    last5Transactions,
    tvl,
    evolutionData,
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
      <H1 mb="xl">Platform Overview Dashboard</H1>
      <Box display="flex" flexWrap="wrap" mx={-2}>
        <Box width={[1, 1 / 2, 1 / 5]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card" textAlign="center">
            <Text variant="sm" color="grey60">Total Users</Text>
            <H2 mt="md" color="primary100">{totalUsers}</H2>
          </Box>
        </Box>
        <Box width={[1, 1 / 2, 1 / 5]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card" textAlign="center">
            <Text variant="sm" color="grey60">Total Wallets</Text>
            <H2 mt="md" color="primary100">{totalWallets}</H2>
          </Box>
        </Box>
        <Box width={[1, 1 / 2, 1 / 5]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card" textAlign="center">
            <Text variant="sm" color="grey60">Total Transactions</Text>
            <H2 mt="md" color="primary100">{totalTransactions}</H2>
          </Box>
        </Box>
        <Box width={[1, 1 / 2, 1 / 5]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card" textAlign="center">
            <Text variant="sm" color="grey60">Total Deposits</Text>
            <H2 mt="md" color="success">{totalDeposits} USDT</H2>
          </Box>
        </Box>
        <Box width={[1, 1 / 2, 1 / 5]} p={2}>
          <Box bg="white" p="lg" borderRadius="default" boxShadow="card" textAlign="center">
            <Text variant="sm" color="grey60">Total Value Locked</Text>
            <H2 mt="md" color="success">{tvl} USDT</H2>
          </Box>
        </Box>
      </Box>

      {evolutionData && evolutionData.length > 0 && (
        <Box mt="xl">
          <H2 mb="lg">Platform Evolution (Last 30 Days)</H2>
          <Box display="flex" flexWrap="wrap" mx={-2}>
            <Box width={[1, 1, 1 / 2]} p={2}>
              <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
                <H3 mb="lg">User Growth</H3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <AreaChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="users" name="New Users" stroke="#4268F6" fill="#E2E8F0" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Box>
            </Box>

            <Box width={[1, 1, 1 / 2]} p={2}>
              <Box bg="white" p="lg" borderRadius="default" boxShadow="card">
                <H3 mb="lg">Transaction Volume</H3>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={evolutionData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="txVolume" name="Transaction Vol (USDT)" fill="#00D28A" />
                      <Bar dataKey="deposits" name="Deposit Vol (USDT)" fill="#8A2BE2" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      <Box display="flex" flexWrap="wrap" mx={-2} mt="xl">
        <Box width={[1, 1, 1 / 2]} p={2}>
          <H2 mb="lg">Recent Users</H2>
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
          <H2 mb="lg">Recent Transactions</H2>
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
