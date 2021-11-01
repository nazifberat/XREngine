import React from 'react'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import Divider from '@material-ui/core/Divider'
import ListItemText from '@material-ui/core/ListItemText'
import ListItemAvatar from '@material-ui/core/ListItemAvatar'
import Avatar from '@material-ui/core/Avatar'
import Chip from '@material-ui/core/Chip'
import { useStyle, useStyles } from './style'

const SentInvites = () => {
  const invites = [
    {
      id: 'WGTWF-123123',
      name: 'Kimenyi',
      description: 'Evening meeting',
      accepted: true
    },
    {
      id: 'WGTWF-12312',
      name: 'Kevin',
      description: 'Evening show',
      accepted: true
    },
    {
      id: 'WGTWF-1231',
      name: 'Mugisha',
      description: 'Evening meeting',
      accepted: false
    },
    {
      id: 'WGTWF-123',
      name: 'Kamana',
      description: 'Evening meeting',
      status: 'accepted',
      accepted: true
    },
    {
      id: 'WGTWF-12',
      name: 'Karera',
      description: 'Evening meeting',
      accepted: false
    },
    {
      id: 'WGTWF-1',
      name: 'Emmy',
      description: 'Evening meeting',
      accepted: true
    }
  ]
  const classes = useStyles()
  const classex = useStyles()

  return (
    <div className={classes.scroll}>
      <List className={classes.rootList}>
        {invites.map((el) => {
          return (
            <div key={el.id}>
              <ListItem alignItems="flex-start">
                <ListItemAvatar>
                  <Avatar>{el.name.slice(0, 1).toLocaleUpperCase()}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  style={{ backgroundColor: '#43484F' }}
                  primary={el.name}
                  secondary={<React.Fragment>{el.description}</React.Fragment>}
                />
                {el.accepted ? (
                  <Chip
                    label="accepted"
                    variant="outlined"
                    style={{ position: 'absolute', top: '1rem', right: '2rem', color: '#f1f1f1' }}
                  />
                ) : (
                  <Chip
                    label="pending"
                    variant="outlined"
                    style={{ position: 'absolute', top: '1rem', right: '2rem', color: '#f1f1f1' }}
                  />
                )}
              </ListItem>

              <Divider variant="fullWidth" component="li" style={{ backgroundColor: '#15171B' }} />
            </div>
          )
        })}
      </List>
    </div>
  )
}

export default SentInvites
