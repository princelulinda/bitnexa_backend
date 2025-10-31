import React from 'react'
import {
  Box,
  H2,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Text,
} from '@adminjs/design-system'

const ConsolidationReport = (props) => {
  const { records, totalBalance, mainWalletAddress } = props

  return (
    <Box variant="grey">
      <Box variant="white" p="xl">
        <H2>Rapport de Consolidation</H2>
        <Text fontWeight="bold" mb="lg">
          Portefeuille Principal : {mainWalletAddress || 'Non configuré'}
        </Text>
        <Text>Total à consolider: {totalBalance} USDT</Text>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Adresse</TableCell>
              <TableCell>Réseau</TableCell>
              <TableCell>Solde</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records &&
              records.map((record) => (
                <TableRow key={record.address}>
                  <TableCell>{record.address}</TableCell>
                  <TableCell>{record.network}</TableCell>
                  <TableCell>{record.balance} USDT</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}

export default ConsolidationReport
