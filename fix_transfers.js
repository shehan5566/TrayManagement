const fs = require('fs');
let content = fs.readFileSync('views/transfers.ejs', 'utf8');

const correctStructure = `                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Doc No</th>
                                    <th>From Branch</th>
                                    <th>Dispatched Qty</th>
                                    <th>Remarks</th>
                                    <th style="text-align: center;">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <% const incoming=transfers.filter(t=> t.toLocationId === user.locationId && t.status === 'PENDING'); %>
                                <% if(incoming.length===0) { %>
                                    <tr>
                                        <td colspan="6" style="text-align: center; color: var(--text-light);">No pending incoming transfers.</td>
                                    </tr>
                                <% } else { %>
                                    <% incoming.forEach(t=> { %>
                                        <tr>
                                            <td><%= new Date(t.dispatchedDate).toLocaleString() %></td>
                                            <td><span class="badge" style="background-color: var(--accent-yellow); color: #333;"><%= t.transferDocNo || 'N/A' %></span></td>
                                            <td><%= t.fromLocationName %></td>
                                            <td><strong><%= t.dispatchedQty %></strong></td>
                                            <td><%= t.remarks || '-' %></td>`;

content = content.replace(/<table>[\s\S]*?<td>\s*<div style="display: flex; gap: 8px; justify-content: center;"/, '<table>\n' + correctStructure + '\n                                                    <td>\n                                                        <div style="display: flex; gap: 8px; justify-content: center;"');

fs.writeFileSync('views/transfers.ejs', content);
console.log('Restored Incoming Transfers Table');
