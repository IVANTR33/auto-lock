const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'locklist',
    description: 'Muestra los canales bloqueados.',
    async execute(client, message, args, { lockedChannels, paginationStates, generatePaginationButtons }) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ ¡No tienes los permisos para usar este comando!');
        }

        try {
            const lockedList = Array.from(lockedChannels.entries())
                .map(([id, data]) => {
                    const channel = client.channels.cache.get(id);
                    return channel ? {
                        id,
                        channelName: channel.name,
                        pokemon: data.pokemon || 'Desconocido',
                        type: data.type === 'private' ? 'Privado' : 'Público'
                    } : null;
                })
                .filter(item => item !== null)
                .sort((a, b) => a.pokemon.localeCompare(b.pokemon));

            if (lockedList.length === 0) {
                return message.reply('No hay canales bloqueados actualmente.');
            }

            const itemsPerPage = 5;
            const totalPages = Math.ceil(lockedList.length / itemsPerPage);

            const generateEmbed = (currentPage) => {
                const start = currentPage * itemsPerPage;
                const end = start + itemsPerPage;
                const currentItems = lockedList.slice(start, end);

                const embed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`📋 Canales Bloqueados (${lockedList.length})`)
                    .setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });

                embed.setDescription(
                    currentItems.length === 0 
                        ? 'No hay canales bloqueados en esta página.'
                        : currentItems.map(item => 
                            `🔒 **${item.pokemon}** (Canal ${item.channelName})\n` +
                            `• Tipo: ${item.type}\n` +
                            `• [Ir al Canal](https://discord.com/channels/${message.guild.id}/${item.id})`
                          ).join('\n\n')
                );

                return embed;
            };
            
            const initialState = { 
                currentPage: 0,
                lockedList,
                itemsPerPage,
                totalPages,
                messageAuthorId: message.author.id,
                commandName: 'locklist',
                customPrefix: 'locklist_'
            };
            const reply = await message.reply({ 
                embeds: [generateEmbed(initialState.currentPage)], 
                components: [generatePaginationButtons(initialState.currentPage, totalPages, 'locklist_')],
                fetchReply: true
            });

            paginationStates.set(reply.id, initialState);
        } catch (error) {
            console.error('❌ Error en comando locklist:', error);
            message.reply('❌ Ocurrió un error al mostrar la lista de canales bloqueados.');
        }
    },
    handlePagination: async (interaction, state, generatePaginationButtons) => {
        if (interaction.customId.includes('_close_list')) return interaction.message.delete().catch(() => {});
        if (interaction.user.id !== state.messageAuthorId) {
            return interaction.reply({
                content: '❌ Solo el autor del comando puede interactuar con esta paginación.',
                ephemeral: true
            });
        }

        if (interaction.customId === 'locklist_prev_page' && state.currentPage > 0) {
            state.currentPage--;
        } else if (interaction.customId === 'locklist_next_page' && state.currentPage < state.totalPages - 1) {
            state.currentPage++;
        } else if (interaction.customId === 'locklist_close_list') {
            paginationStates.delete(interaction.message.id);
            return interaction.message.delete().catch(() => interaction.update({ components: [] }));
        }

        const start = state.currentPage * state.itemsPerPage;
        const end = start + state.itemsPerPage;
        const currentItems = state.lockedList.slice(start, end);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📋 Canales Bloqueados (${state.lockedList.length})`)
            .setDescription(
                currentItems.map(item => 
                    `🔒 **${item.pokemon}** (Canal ${item.channelName})\n` +
                    `• Tipo: ${item.type}\n` +
                    `• [Ir al Canal](https://discord.com/channels/${interaction.guild.id}/${item.id})`
                ).join('\n\n')
            )
            .setFooter({ text: `Página ${state.currentPage + 1} de ${state.totalPages}` });

        await interaction.update({ 
            embeds: [embed], 
            components: [generatePaginationButtons(state.currentPage, state.totalPages, 'locklist_')] 
        });
    }
};